// Аввалин админи ноҳия (ва ихтиёрӣ мактаби намунавӣ). Иҷро: npm run db:seed
import { PrismaClient, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

const db = new PrismaClient();

function genPassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p = '';
  while (!(/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p))) {
    p = Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join('');
  }
  return p;
}

async function makeUser(role: Role, schoolId: number | null, fullName: string, login: string) {
  const password = genPassword();
  await db.user.create({ data: { role, schoolId, fullName, login, passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true } });
  return password;
}

async function main() {
  // 1) Мактаб (портал барои як мактаб — МТМУ №12)
  const name = (process.env.SCHOOL_NAME ?? 'МТМУ №12').trim();
  const district = (process.env.SCHOOL_DISTRICT ?? 'Зафаробод').trim();
  let school = await db.school.findFirst({ where: { name } });
  if (!school) {
    school = await db.school.create({ data: { name, district, settings: { create: {} } } });
    console.log(`Мактаб «${name}» сохта шуд.`);
  }

  // 2) Мудир — ҳисоби аввал; мудир худаш мутахассисонро месозад
  const dirLogin = (process.env.SEED_DIRECTOR_LOGIN ?? 'mudir').trim().toLowerCase();
  const dirPassword = process.env.SEED_DIRECTOR_PASSWORD;
  if (await db.user.findUnique({ where: { login: dirLogin } })) {
    console.log(`Мудир "${dirLogin}" аллакай ҳаст — тағйир дода нашуд.`);
  } else {
    if (!dirPassword || dirPassword.length < 8) throw new Error('SEED_DIRECTOR_PASSWORD-ро дар .env гузоред (камаш 8 аломат).');
    const dir = await db.user.create({
      data: { role: 'DIRECTOR', schoolId: school.id, fullName: process.env.SEED_DIRECTOR_NAME ?? 'Мудири мактаб', login: dirLogin, passwordHash: await bcrypt.hash(dirPassword, 12), mustChangePassword: true },
    });
    await db.auditLog.create({ data: { action: 'seed.director_created', actorId: dir.id, schoolId: school.id, entity: 'User', entityId: String(dir.id) } });
    console.log(`Мудир "${dirLogin}" сохта шуд → тугмаи «Мутахассис» → дар воридшавии аввал паролро иваз кунед.`);
  }

  // 3) Ихтиёрӣ: мутахассиси аввал
  if (process.env.SEED_SPECIALIST === '1' && !(await db.user.findFirst({ where: { schoolId: school.id, role: 'SPECIALIST' } }))) {
    const pwd = await makeUser('SPECIALIST', school.id, 'Мутахассис', `s${school.id}-0001`);
    console.log(`Мутахассис: s${school.id}-0001 / ${pwd}`);
  }

  // 4) Ихтиёрӣ: админи ноҳия (барои портали чанд мактаба; барои як мактаб лозим нест)
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminPassword) {
    const login = (process.env.SEED_ADMIN_LOGIN ?? 'admin').trim().toLowerCase();
    if (!(await db.user.findUnique({ where: { login } }))) {
      if (adminPassword.length < 8) throw new Error('SEED_ADMIN_PASSWORD камаш 8 аломат.');
      await db.user.create({ data: { role: 'DISTRICT_ADMIN', fullName: 'Админи ноҳия', login, passwordHash: await bcrypt.hash(adminPassword, 12), mustChangePassword: true } });
      console.log(`Админи ноҳия "${login}" сохта шуд.`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
