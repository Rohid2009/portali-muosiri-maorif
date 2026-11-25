import 'server-only';
import type { Prisma, Role } from '@prisma/client';
import { db } from './db';
import { generatePassword, loginCandidate } from './credentials';
import { hashPassword } from './password';

type Tx = Prisma.TransactionClient;

/** Ҳисоби нав бо логин ва пароли автоматӣ. Парол танҳо як бор баргардонида мешавад. */
export async function createAccount(
  input: { role: Role; schoolId: number | null; fullName: string; mustChangePassword: boolean },
  tx: Tx = db,
) {
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  for (let i = 0; i < 30; i++) {
    const login = loginCandidate(input.role, input.schoolId);
    const taken = await tx.user.findUnique({ where: { login }, select: { id: true } });
    if (taken) continue;
    const user = await tx.user.create({
      data: {
        role: input.role,
        schoolId: input.schoolId,
        fullName: input.fullName,
        login,
        passwordHash,
        mustChangePassword: input.mustChangePassword,
      },
    });
    return { user, login, password };
  }
  throw new Error('Логини ягона сохта нашуд. Боз кӯшиш кунед.');
}

/** Пароли навро тавлид мекунад, қуфлро мекушояд ва ҳамаи сессияҳоро мебандад. */
export async function resetPassword(userId: number, mustChangePassword: boolean): Promise<string> {
  const password = generatePassword();
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password), mustChangePassword, failedAttempts: 0, lockedUntil: null },
    }),
    db.session.deleteMany({ where: { userId } }),
  ]);
  return password;
}

/** Кӣ пароли киро иваз карда метавонад */
export function canManage(actor: Role, target: Role): boolean {
  switch (actor) {
    case 'DISTRICT_ADMIN':
      return target === 'DIRECTOR' || target === 'SPECIALIST';
    case 'DIRECTOR':
      return target === 'SPECIALIST' || target === 'TEACHER' || target === 'PARENT';
    case 'SPECIALIST':
      return target === 'TEACHER' || target === 'PARENT';
    default:
      return false;
  }
}
