import 'server-only';
import { redirect } from 'next/navigation';
import type { Role, User } from '@prisma/client';
import { readSession } from './session';

export type CurrentUser = Pick<User, 'id' | 'schoolId' | 'role' | 'fullName' | 'login' | 'mustChangePassword'>;

/** Саҳифаи асосии ҳар нақш */
export const ROLE_HOME: Record<Role, string> = {
  DISTRICT_ADMIN: '/admin',
  DIRECTOR: '/director',
  SPECIALIST: '/specialist',
  TEACHER: '/teacher',
  PARENT: '/parent',
};

/** Кадом тугмаи саҳифаи асосӣ ба кадом нақшҳо иҷозат медиҳад */
export const PORTAL_ROLES = {
  teacher: ['TEACHER'],
  parent: ['PARENT'],
  staff: ['SPECIALIST', 'DIRECTOR', 'DISTRICT_ADMIN'], // мудир ва админ аз тугмаи «Мутахассис»
} as const satisfies Record<string, readonly Role[]>;
export type Portal = keyof typeof PORTAL_ROLES;

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const s = await readSession();
  if (!s) return null;
  const { id, schoolId, role, fullName, login, mustChangePassword } = s.user;
  return { id, schoolId, role, fullName, login, mustChangePassword };
}

/**
 * Посбони сервер: ҳар саҳифа ва ҳар server action бояд инро даъват кунад.
 * Интерфейс танҳо тугмаҳоро пинҳон мекунад — санҷиши аслӣ ҳамин ҷост.
 */
export async function requireRole(allowed: readonly Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (user.mustChangePassword) redirect('/change-password');
  if (!allowed.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

/**
 * Барои server action-ҳо: ба ҷои redirect хато мепартояд.
 * Ҳамчунин санҷиш мекунад, ки корбар танҳо ба мактаби худ дастрасӣ дорад.
 */
export async function assertRole(allowed: readonly Role[], schoolId?: number): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !allowed.includes(user.role)) {
    throw new Error('Дастрасӣ манъ аст');
  }
  if (schoolId !== undefined && user.role !== 'DISTRICT_ADMIN' && user.schoolId !== schoolId) {
    throw new Error('Дастрасӣ ба мактаби дигар манъ аст');
  }
  return user;
}
