import bcrypt from 'bcryptjs';

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Барои вақте ки логин ёфт нашуд: ҳамон вақти санҷишро сарф мекунем,
// то аз рӯи суръати ҷавоб фаҳмидан нашавад, ки логин вуҷуд дорад ё не.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', COST);
export async function fakeVerify(): Promise<false> {
  await bcrypt.compare('x', DUMMY_HASH);
  return false;
}
