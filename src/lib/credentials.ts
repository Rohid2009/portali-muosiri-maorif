// Тавлиди паролҳо ва логинҳо (бе вобастагии беруна — танҳо node:crypto).
import { randomInt } from 'node:crypto';

// Ҳарфҳое, ки бо ҳам омехта мешаванд, хориҷ шудаанд: 0 O o 1 l I
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LOWER + UPPER + DIGITS;

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

/**
 * Пароли тасодуфии криптографӣ (CSPRNG).
 * 10 аломат аз 56 → ~58 бит; эҳтимоли такрор амалан сифр аст,
 * бинобар ин ҳар парол «ягона ва гуногун» аст.
 */
export function generatePassword(length = 10): string {
  if (length < 8) throw new Error('Парол бояд на камтар аз 8 аломат бошад');
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Fisher–Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export const ROLE_PREFIX = {
  DISTRICT_ADMIN: 'a',
  DIRECTOR: 'd',
  SPECIALIST: 's',
  TEACHER: 't',
  PARENT: 'p',
} as const;

/** Номзади логин: "t12-4821" (нақш + мактаб + 4 рақам). Ягонагӣ дар база санҷида мешавад. */
export function loginCandidate(role: keyof typeof ROLE_PREFIX, schoolId: number | null): string {
  const num = String(randomInt(10000)).padStart(4, '0');
  return `${ROLE_PREFIX[role]}${schoolId ?? 0}-${num}`;
}

/** Талаботи пароли нав, ки корбар худаш мегузорад. Хатогиро бармегардонад ё null. */
export function validateNewPassword(pwd: string): string | null {
  if (pwd.length < 8) return 'Парол бояд на камтар аз 8 аломат бошад.';
  if (pwd.length > 128) return 'Парол хеле дароз аст.';
  if (!/\p{L}/u.test(pwd) || !/\d/.test(pwd)) return 'Парол бояд ҳам ҳарф ва ҳам рақам дошта бошад.';
  return null;
}

/** Логинро ба шакли ягона меорад (бе фосила, ҳарфи хурд). */
export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

/** Логин: 3–32 аломат, ҳарфҳои лотинии хурд, рақам, «.», «_», «-». Хатогиро бармегардонад ё null. */
export function validateLogin(login: string): string | null {
  if (login.length < 3 || login.length > 32) return 'Логин бояд аз 3 то 32 аломат бошад.';
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(login)) return 'Логин танҳо ҳарфҳои лотинӣ (a–z), рақам ва . _ - дошта метавонад.';
  return null;
}
