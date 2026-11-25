'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { assertRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { createAccount, resetPassword, canManage } from '@/lib/accounts';
import { cleanName } from '@/lib/normalize';
import { done, fail, errorMessage, type FormState } from '@/lib/form';

const id = z.coerce.number().int().positive();
function f(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
}

// ───────────── Админи ноҳия ─────────────

export async function createSchool(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await assertRole(['DISTRICT_ADMIN']);
    const name = cleanName(z.string().min(2).max(200).parse(f(fd, 'name')));
    const district = cleanName(z.string().min(2).max(100).parse(f(fd, 'district')));
    const school = await db.school.create({ data: { name, district, settings: { create: {} } } });
    await audit({ action: 'school.create', actorId: me.id, schoolId: school.id, entity: 'School', entityId: school.id, details: { name, district } });
    revalidatePath('/admin');
    return done(`Мактаб «${name}» сохта шуд.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function setSchoolActive(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await assertRole(['DISTRICT_ADMIN']);
    const schoolId = id.parse(f(fd, 'schoolId'));
    const active = f(fd, 'active') === '1';
    await db.school.update({ where: { id: schoolId }, data: { isActive: active } });
    if (!active) await db.session.deleteMany({ where: { user: { schoolId } } });
    await audit({ action: active ? 'school.activate' : 'school.deactivate', actorId: me.id, schoolId, entity: 'School', entityId: schoolId });
    revalidatePath('/admin');
    return done(active ? 'Мактаб фаъол шуд.' : 'Мактаб ғайрифаъол шуд.');
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Админи ноҳия мудир ва мутахассис месозад; мудир — мутахассис */
export async function createStaff(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await assertRole(['DISTRICT_ADMIN', 'DIRECTOR']);
    const role = z.enum(['DIRECTOR', 'SPECIALIST']).parse(f(fd, 'role'));
    if (!canManage(me.role, role)) throw new Error('Дастрасӣ манъ аст.');
    const schoolId = me.role === 'DISTRICT_ADMIN' ? id.parse(f(fd, 'schoolId')) : me.schoolId!;
    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('Мактаб ёфт нашуд.');
    const fullName = cleanName(z.string().min(2).max(150).parse(f(fd, 'fullName')));
    const acc = await createAccount({ role, schoolId, fullName, mustChangePassword: true });
    await audit({ action: 'user.create', actorId: me.id, schoolId, entity: 'User', entityId: acc.user.id, details: { role, fullName } });
    revalidatePath('/admin');
    revalidatePath('/director/staff');
    return done(`${role === 'DIRECTOR' ? 'Мудир' : 'Мутахассис'} сохта шуд.`, [{ fullName, login: acc.login, password: acc.password, note: school.name }]);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function resetStaffPassword(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await assertRole(['DISTRICT_ADMIN', 'DIRECTOR']);
    const target = await db.user.findUnique({ where: { id: id.parse(f(fd, 'userId')) } });
    if (!target || !canManage(me.role, target.role)) throw new Error('Дастрасӣ манъ аст.');
    if (me.role === 'DIRECTOR' && target.schoolId !== me.schoolId) throw new Error('Дастрасӣ манъ аст.');
    const password = await resetPassword(target.id, true);
    await audit({ action: 'password.reset', actorId: me.id, schoolId: target.schoolId, entity: 'User', entityId: target.id, details: { role: target.role } });
    return done('Пароли нав сохта шуд.', [{ fullName: target.fullName, login: target.login, password }]);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function setStaffActive(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await assertRole(['DISTRICT_ADMIN', 'DIRECTOR']);
    const target = await db.user.findUnique({ where: { id: id.parse(f(fd, 'userId')) } });
    if (!target || !canManage(me.role, target.role)) throw new Error('Дастрасӣ манъ аст.');
    if (me.role === 'DIRECTOR' && target.schoolId !== me.schoolId) throw new Error('Дастрасӣ манъ аст.');
    const active = f(fd, 'active') === '1';
    await db.user.update({ where: { id: target.id }, data: { isActive: active } });
    if (!active) await db.session.deleteMany({ where: { userId: target.id } });
    await audit({ action: active ? 'user.activate' : 'user.deactivate', actorId: me.id, schoolId: target.schoolId, entity: 'User', entityId: target.id });
    revalidatePath('/admin');
    revalidatePath('/director/staff');
    return done(active ? 'Фаъол шуд.' : 'Ғайрифаъол шуд.');
  } catch (e) {
    return fail(errorMessage(e));
  }
}
