'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { assertRole } from '@/lib/auth';
import { audit, clientIp } from '@/lib/audit';
import { hashPassword } from '@/lib/password';
import { createSession } from '@/lib/session';
import { validateNewPassword } from '@/lib/credentials';
import { normalizePhone } from '@/lib/phone';
import { cleanName } from '@/lib/normalize';
import { done, fail, errorMessage, type FormState } from '@/lib/form';

const id = z.coerce.number().int().positive();
const RELATIONS = ['падар', 'модар', 'сарпараст'];
const MAX_CHILDREN_PER_REQUEST = 5;

function f(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
}

/**
 * Хонандагони интихобшуда бояд воқеан дар ҳамин синфи соли ҷорӣ бошанд.
 * Дархост сохта мешавад — дастрасӣ танҳо баъди тасдиқи мутахассис.
 */
async function createRequests(parentUserId: number, classId: number, studentIds: number[], relation: string | null) {
  const cls = await db.class.findUnique({ where: { id: classId }, include: { academicYear: true, school: { include: { settings: true } } } });
  if (!cls || !cls.academicYear.isCurrent || !cls.school.isActive) throw new Error('Синф ёфт нашуд.');
  if (cls.school.settings && !cls.school.settings.allowParentSignup) throw new Error('Ин мактаб сабти номи мустақилро хомӯш кардааст — ба мутахассис муроҷиат кунед.');
  const valid = await db.classEnrollment.findMany({
    where: { classId, studentId: { in: studentIds }, student: { status: { in: ['ACTIVE', 'ABROAD'] } } },
    select: { studentId: true },
  });
  if (valid.length !== studentIds.length) throw new Error('Хонанда ёфт нашуд.');
  const already = await db.parentStudent.findMany({ where: { parentUserId, studentId: { in: studentIds } }, select: { studentId: true } });
  const fresh = studentIds.filter((s) => !already.some((a) => a.studentId === s));
  for (const studentId of fresh) {
    await db.parentLinkRequest.upsert({
      where: { parentUserId_studentId: { parentUserId, studentId } },
      create: { schoolId: cls.schoolId, parentUserId, studentId, relation },
      // Агар пештар рад шуда бошад — аз нав дархост
      update: { status: 'PENDING', relation, reviewedById: null, reviewedAt: null },
    });
  }
  return { schoolId: cls.schoolId, count: fresh.length };
}

function pickedStudents(fd: FormData): number[] {
  const ids = [...new Set(fd.getAll('studentIds').map((v) => id.parse(v)))];
  if (!ids.length) throw new Error('Фарзанди худро аз рӯйхат интихоб кунед.');
  if (ids.length > MAX_CHILDREN_PER_REQUEST) throw new Error(`Дар як бор то ${MAX_CHILDREN_PER_REQUEST} хонанда.`);
  return ids;
}

/** Сабти номи волид: ном, телефон, парол + интихоби фарзанд(он) */
export async function registerParent(_p: FormState, fd: FormData): Promise<FormState> {
  let ok = false;
  try {
    // Маҳдудият: аз як IP на зиёда аз 5 сабти ном дар як соат
    const ip = clientIp();
    const recent = await db.loginAttempt.count({ where: { ip, login: 'signup', createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    if (recent >= 5) throw new Error('Кӯшишҳои зиёд. Баъдтар боз кӯшиш кунед.');
    await db.loginAttempt.create({ data: { ip, login: 'signup', success: false } });

    const fullName = cleanName(z.string().min(5, 'Ному насаби пурраро нависед.').max(150).parse(f(fd, 'fullName')));
    const phone = normalizePhone(f(fd, 'phone'));
    if (!phone) throw new Error('Рақами телефонро дуруст нависед (мисол: 90 123 45 67).');
    const password = f(fd, 'password');
    const policy = validateNewPassword(password);
    if (policy) throw new Error(policy);
    if (password !== f(fd, 'confirm')) throw new Error('Парол ва такрори он мувофиқ нестанд.');
    const relation = RELATIONS.includes(f(fd, 'relation')) ? f(fd, 'relation') : null;
    const classId = id.parse(f(fd, 'classId'));
    const studentIds = pickedStudents(fd);

    if (await db.user.findFirst({ where: { OR: [{ phone }, { login: phone }] }, select: { id: true } })) {
      throw new Error('Ин рақам аллакай сабт шудааст. Ворид шавед ё ба мутахассис барои пароли нав муроҷиат кунед.');
    }
    const cls = await db.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    if (!cls) throw new Error('Синф ёфт нашуд.');

    const user = await db.user.create({
      data: { role: 'PARENT', schoolId: cls.schoolId, fullName, login: phone, phone, passwordHash: await hashPassword(password), mustChangePassword: false },
    });
    const r = await createRequests(user.id, classId, studentIds, relation);
    await audit({ action: 'parent.signup', actorId: user.id, schoolId: r.schoolId, entity: 'User', entityId: user.id, details: { requested: studentIds, relation } });
    await createSession(user.id);
    ok = true;
  } catch (e) {
    return fail(errorMessage(e));
  }
  if (ok) redirect('/parent');
  return fail('Хатои номаълум.');
}

/** Волиди воридшуда фарзанди дигарро илова мекунад (боз дархост) */
export async function requestChildren(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await assertRole(['PARENT']);
    const classId = id.parse(f(fd, 'classId'));
    const relation = RELATIONS.includes(f(fd, 'relation')) ? f(fd, 'relation') : null;
    const pending = await db.parentLinkRequest.count({ where: { parentUserId: me.id, status: 'PENDING' } });
    if (pending >= 10) throw new Error('Дархостҳои зиёд интизори тасдиқанд.');
    const r = await createRequests(me.id, classId, pickedStudents(fd), relation);
    await audit({ action: 'parent.link_request', actorId: me.id, schoolId: r.schoolId, details: { count: r.count } });
    revalidatePath('/parent');
    return done(r.count ? 'Дархост фиристода шуд. Пас аз тасдиқи мутахассис баҳоҳоро мебинед.' : 'Ин фарзанд аллакай ба ҳисоби шумо пайваст аст.');
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Мутахассис/мудир дархости волидро тасдиқ ё рад мекунад */
export async function reviewLinkRequest(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await assertRole(['SPECIALIST', 'DIRECTOR']);
    const req = await db.parentLinkRequest.findUnique({ where: { id: id.parse(f(fd, 'requestId')) } });
    if (!req || req.schoolId !== me.schoolId) throw new Error('Дархост ёфт нашуд.');
    if (req.status !== 'PENDING') throw new Error('Дархост аллакай баррасӣ шудааст.');
    const approve = f(fd, 'decision') === 'approve';
    await db.$transaction(async (tx) => {
      await tx.parentLinkRequest.update({
        where: { id: req.id },
        data: { status: approve ? 'APPROVED' : 'REJECTED', reviewedById: me.id, reviewedAt: new Date() },
      });
      if (approve) {
        await tx.parentStudent.upsert({
          where: { parentUserId_studentId: { parentUserId: req.parentUserId, studentId: req.studentId } },
          create: { parentUserId: req.parentUserId, studentId: req.studentId, schoolId: req.schoolId },
          update: {},
        });
      }
      await audit({ action: approve ? 'parent.link_approve' : 'parent.link_reject', actorId: me.id, schoolId: req.schoolId, entity: 'ParentLinkRequest', entityId: req.id, details: { parentId: req.parentUserId, studentId: req.studentId } }, tx);
    });
    revalidatePath('/specialist/parents');
    revalidatePath('/specialist');
    return done(approve ? 'Тасдиқ шуд — волид акнун фарзанди худро мебинад.' : 'Дархост рад шуд.');
  } catch (e) {
    return fail(errorMessage(e));
  }
}
