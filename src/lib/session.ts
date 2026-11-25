import 'server-only';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';

export const SESSION_COOKIE = 'sid';
const SESSION_DAYS = 7;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Сессияи нав: токен танҳо дар cookie, дар база — хеши он. */
export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/** Сессияи ҷориро бо корбар бармегардонад ё null. */
export async function readSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date() || !session.user.isActive) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  // Навсозии lastSeen на зиёда аз як бор дар 10 дақиқа (камтар дархост ба база)
  if (Date.now() - session.lastSeenAt.getTime() > 10 * 60 * 1000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session;
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  cookies().delete(SESSION_COOKIE);
}

/** Ҳамаи сессияҳои дигари корбарро мебандад (баъди ивази парол). */
export async function destroyOtherSessions(userId: number): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const keep = token ? hashToken(token) : '';
  await db.session.deleteMany({ where: { userId, NOT: { id: keep } } });
}
