'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPassword, fakeVerify, hashPassword } from '@/lib/password';
import { createSession, destroySession, destroyOtherSessions } from '@/lib/session';
import { getCurrentUser, PORTAL_ROLES, ROLE_HOME, type Portal } from '@/lib/auth';
import { audit, clientIp } from '@/lib/audit';
import { normalizeLogin, validateNewPassword, validateLogin } from '@/lib/credentials';
import { normalizePhone } from '@/lib/phone';

export type FormState = { error?: string; ok?: string };

// Маҳдудияти IP: зиёда аз 20 кӯшиши хато дар 15 дақиқа → интизор шавед
const IP_WINDOW_MIN = 15;
const IP_MAX_FAILS = 20;
const GENERIC_ERROR = 'Логин ё парол нодуруст аст.';

const loginSchema = z.object({
  portal: z.enum(['teacher', 'parent', 'staff']),
  login: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    portal: formData.get('portal'),
    login: formData.get('login'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'Логин ва паролро ворид кунед.' };

  const { portal, password } = parsed.data;
  const login = normalizeLogin(parsed.data.login);
  const ip = clientIp();

  // 1) Rate limit аз рӯи IP
  const since = new Date(Date.now() - IP_WINDOW_MIN * 60 * 1000);
  const ipFails = await db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } });
  if (ipFails >= IP_MAX_FAILS) {
    return { error: `Кӯшишҳои зиёд. ${IP_WINDOW_MIN} дақиқа баъд боз кӯшиш кунед.` };
  }

  // Волидон бо рақами телефон ҳам ворид мешаванд ("90 123 45 67" → "992901234567")
  const phone = normalizePhone(parsed.data.login);
  const user = await db.user.findFirst({
    where: phone ? { OR: [{ login }, { phone }] } : { login },
    include: { school: { include: { settings: true } } },
  });

  // 2) Логин нест ё ғайрифаъол — ҳамон хатои умумӣ (ва ҳамон вақт)
  if (!user || !user.isActive || (user.school && !user.school.isActive)) {
    await fakeVerify();
    await db.loginAttempt.create({ data: { ip, login, success: false } });
    return { error: GENERIC_ERROR };
  }

  // 3) Ҳисоб қуфл аст?
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Ҳисоб муваққатан қуфл аст. ${mins} дақиқа баъд кӯшиш кунед ё ба мутахассис муроҷиат кунед.` };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  const roleAllowed = (PORTAL_ROLES[portal as Portal] as readonly string[]).includes(user.role);

  if (!ok || !roleAllowed) {
    await db.loginAttempt.create({ data: { ip, login, success: false } });
    if (!ok) {
      const max = user.school?.settings?.maxLoginAttempts ?? 5;
      const lockMin = user.school?.settings?.lockMinutes ?? 15;
      const attempts = user.failedAttempts + 1;
      const lock = attempts >= max;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: lock ? 0 : attempts,
          lockedUntil: lock ? new Date(Date.now() + lockMin * 60 * 1000) : null,
        },
      });
      await audit({
        action: lock ? 'auth.locked' : 'auth.login_failed',
        actorId: user.id,
        schoolId: user.schoolId,
        details: { portal },
      });
    }
    return { error: GENERIC_ERROR };
  }

  // 4) Муваффақ
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } }),
    db.loginAttempt.create({ data: { ip, login: user.login, success: true } }),
  ]);
  await createSession(user.id);
  await audit({ action: 'auth.login', actorId: user.id, schoolId: user.schoolId, details: { portal } });

  redirect(user.mustChangePassword ? '/change-password' : ROLE_HOME[user.role]);
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await audit({ action: 'auth.logout', actorId: user.id, schoolId: user.schoolId });
  await destroySession();
  redirect('/');
}

const changeSchema = z.object({
  current: z.string().min(1).max(128),
  next: z.string().min(1).max(128),
  confirm: z.string().min(1).max(128),
});

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) redirect('/');

  const parsed = changeSchema.safeParse({
    current: formData.get('current'),
    next: formData.get('next'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return { error: 'Ҳамаи майдонҳоро пур кунед.' };
  const { current, next, confirm } = parsed.data;

  if (next !== confirm) return { error: 'Пароли нав ва такрори он мувофиқ нестанд.' };
  if (next === current) return { error: 'Пароли нав бояд аз пароли ҷорӣ фарқ кунад.' };
  const policyError = validateNewPassword(next);
  if (policyError) return { error: policyError };

  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(current, user.passwordHash))) {
    await audit({ action: 'password.change_failed', actorId: me.id, schoolId: me.schoolId });
    return { error: 'Пароли ҷорӣ нодуруст аст.' };
  }

  await db.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  });
  await destroyOtherSessions(me.id);
  await audit({ action: 'password.change', actorId: me.id, schoolId: me.schoolId, entity: 'User', entityId: me.id });

  // Агар ивази ҳатмӣ буд — ба саҳифаи асосӣ; вагарна дар ҳамин саҳифа паём
  if (user.mustChangePassword) redirect(ROLE_HOME[me.role]);
  return { ok: 'Парол иваз шуд. Дар дастгоҳҳои дигар аз нав ворид шавед.' };
}

/** Корбар логини худро иваз мекунад — танҳо бо пароли ҳозира */
export async function changeLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) redirect('/');
  const current = String(formData.get('current') ?? '');
  const next = normalizeLogin(String(formData.get('login') ?? ''));
  const err = validateLogin(next);
  if (err) return { error: err };
  if (next === me.login) return { error: 'Ин логини ҳозираи шумост.' };

  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(current, user.passwordHash))) {
    await audit({ action: 'login.change_failed', actorId: me.id, schoolId: me.schoolId });
    return { error: 'Пароли ҳозира нодуруст аст.' };
  }
  const asPhone = normalizePhone(next);
  if (asPhone && asPhone !== user.phone) return { error: 'Рақами телефони дигарро ҳамчун логин истифода бурдан мумкин нест.' };
  const taken = await db.user.findFirst({ where: { OR: [{ login: next }, { phone: next }], NOT: { id: me.id } }, select: { id: true } });
  if (taken) return { error: 'Ин логин банд аст. Логини дигар интихоб кунед.' };

  await db.user.update({ where: { id: me.id }, data: { login: next } });
  await audit({ action: 'login.change', actorId: me.id, schoolId: me.schoolId, entity: 'User', entityId: me.id, details: { old: user.login, new: next } });
  return { ok: `Логин иваз шуд. Акнун бо «${next}» ворид шавед.` };
}

/** Рақами телефони худ ва нишон додан/пинҳон кардани он дар рӯйхати тамос */
export async function updateMyContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) redirect('/');
  const raw = String(formData.get('phone') ?? '').trim();
  const phone = raw ? normalizePhone(raw) : null;
  if (raw && !phone) return { error: 'Рақамро дуруст нависед (мисол: 90 123 45 67).' };
  const visible = formData.get('visible') === 'on';
  if (phone) {
    const taken = await db.user.findFirst({ where: { OR: [{ phone }, { login: phone }], NOT: { id: me.id } }, select: { id: true } });
    if (taken) return { error: 'Ин рақам ба ҳисоби дигар пайваст аст.' };
  }
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  // Агар логин худи рақам бошад (волиди сабтиномшуда), рақамро холӣ кардан мумкин нест
  if (!phone && user.login === user.phone) return { error: 'Шумо бо ҳамин рақам ворид мешавед — онро холӣ кардан мумкин нест.' };
  await db.user.update({ where: { id: me.id }, data: { phone, phoneVisible: visible } });
  await audit({ action: 'contact.update', actorId: me.id, schoolId: me.schoolId, details: { phone: phone ? 'set' : 'cleared', visible } });
  return { ok: 'Сабт шуд.' };
}
