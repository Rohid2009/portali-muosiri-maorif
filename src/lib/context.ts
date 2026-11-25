import 'server-only';
import type { Role } from '@prisma/client';
import { db } from './db';
import { assertRole, requireRole, type CurrentUser } from './auth';
import { isoOf, todayISO } from './dates';

export const STAFF: Role[] = ['SPECIALIST', 'DIRECTOR'];

export const DEFAULT_SETTINGS = {
  parentMustChangePassword: true,
  maxLoginAttempts: 5,
  lockMinutes: 15,
  examWeightPercent: 0,
  allowParentSignup: true,
};

export type QuarterInfo = { id: number; number: number; start: string; end: string; closed: boolean };

/** Соли ҷорӣ, чорякҳо, чоряки имрӯза ва танзимоти мактаб */
export async function schoolContext(schoolId: number) {
  const [year, settings] = await Promise.all([
    db.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      include: { quarters: { orderBy: { number: 'asc' } } },
    }),
    db.schoolSettings.findUnique({ where: { schoolId } }),
  ]);
  const today = todayISO();
  const quarters: QuarterInfo[] =
    year?.quarters.map((q) => ({ id: q.id, number: q.number, start: isoOf(q.startDate), end: isoOf(q.endDate), closed: q.isClosed })) ?? [];
  const currentQuarter = quarters.find((q) => q.start <= today && today <= q.end) ?? null;
  return { year, quarters, currentQuarter, settings: settings ?? { schoolId, ...DEFAULT_SETTINGS }, today };
}

/** Барои саҳифаҳо: нақш + мактаб ҳатмӣ */
export async function requireSchoolUser(roles: readonly Role[]): Promise<CurrentUser & { schoolId: number }> {
  const user = await requireRole(roles);
  if (user.schoolId === null) throw new Error('Корбар ба мактаб пайваст нест');
  return user as CurrentUser & { schoolId: number };
}

/** Барои server action-ҳо */
export async function actor(roles: readonly Role[]): Promise<CurrentUser & { schoolId: number }> {
  const user = await assertRole(roles);
  if (user.schoolId === null) throw new Error('Корбар ба мактаб пайваст нест');
  return user as CurrentUser & { schoolId: number };
}
