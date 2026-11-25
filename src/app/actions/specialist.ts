'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { actor, schoolContext, STAFF } from '@/lib/context';
import { audit } from '@/lib/audit';
import { createAccount, resetPassword, canManage } from '@/lib/accounts';
import { cleanName, normalizeClassName } from '@/lib/normalize';
import { isIsoDate, isoOf, toDbDate, todayISO } from '@/lib/dates';
import { quarterGrade } from '@/lib/grades';
import { computePeriods } from '@/lib/periods';
import { done, fail, errorMessage, type Credential, type FormState } from '@/lib/form';
import { generatePassword, validateLogin, validateNewPassword, normalizeLogin } from '@/lib/credentials';
import { hashPassword } from '@/lib/password';
import { normalizePhone } from '@/lib/phone';
import { storageEnabled, uploadFile } from '@/lib/storage';

const id = z.coerce.number().int().positive();
const isoDate = z.string().refine(isIsoDate, 'Санаи нодуруст');
const str = (max = 200) => z.string().trim().min(1).max(max);

function f(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
}

/** Ҳамаи амалҳо аз ин пӯшиш мегузаранд: нақш, хато, revalidate */
async function run(paths: string[], fn: (me: Awaited<ReturnType<typeof actor>>) => Promise<FormState>): Promise<FormState> {
  try {
    const me = await actor(STAFF);
    const res = await fn(me);
    for (const p of paths) revalidatePath(p);
    return res;
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Объект бояд ба мактаби корбар тааллуқ дошта бошад */
function own<T extends { schoolId: number | null }>(obj: T | null, schoolId: number, what: string): T {
  if (!obj || obj.schoolId !== schoolId) throw new Error(`${what} ёфт нашуд`);
  return obj;
}

async function currentYearOrThrow(schoolId: number) {
  const y = await db.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
  if (!y) throw new Error('Аввал соли таҳсилро созед (Сол ва чорякҳо).');
  return y;
}

// ───────────────────────── Сол ва чорякҳо ─────────────────────────

const quarterFields = z.object({
  q1s: isoDate, q1e: isoDate, q2s: isoDate, q2e: isoDate,
  q3s: isoDate, q3e: isoDate, q4s: isoDate, q4e: isoDate,
});

function quartersFrom(fd: FormData) {
  const q = quarterFields.parse(Object.fromEntries(['q1s', 'q1e', 'q2s', 'q2e', 'q3s', 'q3e', 'q4s', 'q4e'].map((k) => [k, f(fd, k)])));
  const list = [
    { number: 1, start: q.q1s, end: q.q1e },
    { number: 2, start: q.q2s, end: q.q2e },
    { number: 3, start: q.q3s, end: q.q3e },
    { number: 4, start: q.q4s, end: q.q4e },
  ];
  for (let i = 0; i < 4; i++) {
    if (list[i].start > list[i].end) throw new Error(`Чоряки ${i + 1}: оғоз баъд аз анҷом аст.`);
    if (i > 0 && list[i].start <= list[i - 1].end) throw new Error(`Чоряки ${i + 1} бо чоряки ${i} мепӯшад.`);
  }
  return list;
}

export async function createYear(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/years'], async (me) => {
    const name = str(20).regex(/^\d{4}-\d{4}$/, 'Ном мисли 2026-2027').parse(f(fd, 'name'));
    const qs = quartersFrom(fd);
    const existing = await db.academicYear.count({ where: { schoolId: me.schoolId } });
    const makeCurrent = existing === 0 || f(fd, 'current') === 'on';
    const year = await db.$transaction(async (tx) => {
      if (makeCurrent) await tx.academicYear.updateMany({ where: { schoolId: me.schoolId }, data: { isCurrent: false } });
      return tx.academicYear.create({
        data: {
          schoolId: me.schoolId,
          name,
          startDate: toDbDate(qs[0].start),
          endDate: toDbDate(qs[3].end),
          isCurrent: makeCurrent,
          quarters: {
            create: qs.map((q) => ({ schoolId: me.schoolId, number: q.number, startDate: toDbDate(q.start), endDate: toDbDate(q.end) })),
          },
        },
      });
    });
    await audit({ action: 'year.create', actorId: me.id, schoolId: me.schoolId, entity: 'AcademicYear', entityId: year.id, details: { name, quarters: qs } });
    return done(`Соли таҳсил ${name} сохта шуд.`);
  });
}

export async function updateQuarter(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/years'], async (me) => {
    const q = own(await db.quarter.findUnique({ where: { id: id.parse(f(fd, 'quarterId')) } }), me.schoolId, 'Чоряк');
    if (q.isClosed) throw new Error('Чоряк баста шудааст. Аввал онро кушоед.');
    const start = isoDate.parse(f(fd, 'start'));
    const end = isoDate.parse(f(fd, 'end'));
    if (start > end) throw new Error('Оғоз баъд аз анҷом аст.');
    const others = await db.quarter.findMany({ where: { academicYearId: q.academicYearId, NOT: { id: q.id } } });
    for (const o of others) {
      if (start <= isoOf(o.endDate) && isoOf(o.startDate) <= end) throw new Error(`Бо чоряки ${o.number} мепӯшад.`);
    }
    await db.quarter.update({ where: { id: q.id }, data: { startDate: toDbDate(start), endDate: toDbDate(end) } });
    await audit({ action: 'quarter.update', actorId: me.id, schoolId: me.schoolId, entity: 'Quarter', entityId: q.id, details: { old: { start: isoOf(q.startDate), end: isoOf(q.endDate) }, new: { start, end } } });
    return done(`Чоряки ${q.number} нав шуд.`);
  });
}

export async function setCurrentYear(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/years'], async (me) => {
    const y = own(await db.academicYear.findUnique({ where: { id: id.parse(f(fd, 'yearId')) } }), me.schoolId, 'Сол');
    await db.$transaction([
      db.academicYear.updateMany({ where: { schoolId: me.schoolId }, data: { isCurrent: false } }),
      db.academicYear.update({ where: { id: y.id }, data: { isCurrent: true } }),
    ]);
    await audit({ action: 'year.set_current', actorId: me.id, schoolId: me.schoolId, entity: 'AcademicYear', entityId: y.id });
    return done(`${y.name} — соли ҷорӣ.`);
  });
}

/** Бастани чоряк: баҳоҳои чорякӣ ҳисоб ва сабт (snapshot) мешаванд */
export async function closeQuarter(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/years', '/specialist/grades'], async (me) => {
    const q = own(await db.quarter.findUnique({ where: { id: id.parse(f(fd, 'quarterId')) } }), me.schoolId, 'Чоряк');
    if (q.isClosed) throw new Error('Чоряк аллакай баста аст.');
    const entries = await db.journalEntry.findMany({
      where: { schoolId: me.schoolId, lessonDate: { gte: q.startDate, lte: q.endDate }, class: { academicYearId: q.academicYearId } },
      select: { studentId: true, subjectId: true, grade: true },
    });
    const groups = new Map<string, { studentId: number; subjectId: number; grades: number[] }>();
    for (const e of entries) {
      const k = `${e.studentId}:${e.subjectId}`;
      const g = groups.get(k) ?? { studentId: e.studentId, subjectId: e.subjectId, grades: [] as number[] };
      if (e.grade !== null) g.grades.push(e.grade);
      groups.set(k, g);
    }
    const kind = (`Q${q.number}`) as 'Q1' | 'Q2' | 'Q3' | 'Q4';
    const rows = [...groups.values()].map((g) => ({
      schoolId: me.schoolId, studentId: g.studentId, subjectId: g.subjectId,
      academicYearId: q.academicYearId, kind, value: quarterGrade(g.grades),
    }));
    await db.$transaction([
      db.periodGrade.deleteMany({ where: { schoolId: me.schoolId, academicYearId: q.academicYearId, kind } }),
      db.periodGrade.createMany({ data: rows }),
      db.quarter.update({ where: { id: q.id }, data: { isClosed: true } }),
    ]);
    await audit({ action: 'quarter.close', actorId: me.id, schoolId: me.schoolId, entity: 'Quarter', entityId: q.id, details: { grades: rows.length } });
    return done(`Чоряки ${q.number} баста шуд. ${rows.length} баҳои чорякӣ сабт шуд.`);
  });
}

export async function reopenQuarter(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/years', '/specialist/grades'], async (me) => {
    const q = own(await db.quarter.findUnique({ where: { id: id.parse(f(fd, 'quarterId')) } }), me.schoolId, 'Чоряк');
    const kind = (`Q${q.number}`) as 'Q1' | 'Q2' | 'Q3' | 'Q4';
    await db.$transaction([
      db.periodGrade.deleteMany({ where: { schoolId: me.schoolId, academicYearId: q.academicYearId, kind } }),
      db.quarter.update({ where: { id: q.id }, data: { isClosed: false } }),
    ]);
    await audit({ action: 'quarter.reopen', actorId: me.id, schoolId: me.schoolId, entity: 'Quarter', entityId: q.id });
    return done(`Чоряки ${q.number} боз шуд.`);
  });
}

// ───────────────────────── Фанҳо ва синфҳо ─────────────────────────

export async function addSubjects(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/subjects'], async (me) => {
    const names = [...new Set(f(fd, 'names').split('\n').map(cleanName).filter(Boolean))];
    if (!names.length) throw new Error('Номи фанро нависед (ҳар фан дар сатри алоҳида).');
    if (names.some((n) => n.length > 100)) throw new Error('Номи фан хеле дароз аст.');
    const res = await db.subject.createMany({ data: names.map((name) => ({ schoolId: me.schoolId, name })), skipDuplicates: true });
    await audit({ action: 'subject.create', actorId: me.id, schoolId: me.schoolId, details: { names } });
    return done(`${res.count} фан илова шуд${res.count < names.length ? ' (такрориҳо сарфи назар шуданд)' : ''}.`);
  });
}

export async function renameSubject(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/subjects'], async (me) => {
    const s = own(await db.subject.findUnique({ where: { id: id.parse(f(fd, 'subjectId')) } }), me.schoolId, 'Фан');
    const name = cleanName(str(100).parse(f(fd, 'name')));
    await db.subject.update({ where: { id: s.id }, data: { name } });
    await audit({ action: 'subject.rename', actorId: me.id, schoolId: me.schoolId, entity: 'Subject', entityId: s.id, details: { old: s.name, new: name } });
    return done('Номи фан иваз шуд.');
  });
}

export async function addClasses(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/classes'], async (me) => {
    const year = await currentYearOrThrow(me.schoolId);
    const raw = f(fd, 'names').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    const parsed = raw.map((r) => ({ r, c: normalizeClassName(r) }));
    const bad = parsed.filter((p) => !p.c).map((p) => p.r);
    if (bad.length) throw new Error(`Номи нодуруст: ${bad.join(', ')} (мисол: 5-А, 10б)`);
    const data = parsed.map((p) => ({ schoolId: me.schoolId, academicYearId: year.id, gradeLevel: p.c!.gradeLevel, letter: p.c!.letter, name: p.c!.name }));
    const res = await db.class.createMany({ data, skipDuplicates: true });
    await audit({ action: 'class.create', actorId: me.id, schoolId: me.schoolId, details: { names: data.map((d) => d.name) } });
    return done(`${res.count} синф илова шуд.`);
  });
}

// ───────────────────────── Корбарон ─────────────────────────

export async function createTeachers(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/teachers'], async (me) => {
    const names = [...new Set(f(fd, 'names').split('\n').map(cleanName).filter(Boolean))];
    if (!names.length) throw new Error('Ному насабро нависед (ҳар омӯзгор дар сатри алоҳида).');
    if (names.length > 25) throw new Error('Дар як бор то 25 нафар.');
    const creds: Credential[] = [];
    for (const fullName of names) {
      const { user, login, password } = await createAccount({ role: 'TEACHER', schoolId: me.schoolId, fullName, mustChangePassword: true });
      creds.push({ fullName, login, password });
      await audit({ action: 'user.create', actorId: me.id, schoolId: me.schoolId, entity: 'User', entityId: user.id, details: { role: 'TEACHER', fullName } });
    }
    return done(`${creds.length} омӯзгор илова шуд.`, creds);
  });
}

export async function resetUserPassword(_p: FormState, fd: FormData): Promise<FormState> {
  return run([], async (me) => {
    const target = await db.user.findUnique({ where: { id: id.parse(f(fd, 'userId')) } });
    if (!target || target.schoolId !== me.schoolId || !canManage(me.role, target.role)) throw new Error('Дастрасӣ манъ аст.');
    const ctx = await schoolContext(me.schoolId);
    const mustChange = target.role === 'PARENT' ? ctx.settings.parentMustChangePassword : true;
    const password = await resetPassword(target.id, mustChange);
    await audit({ action: 'password.reset', actorId: me.id, schoolId: me.schoolId, entity: 'User', entityId: target.id, details: { role: target.role } });
    return done('Пароли нав сохта шуд.', [{ fullName: target.fullName, login: target.login, password }]);
  });
}

export async function setUserActive(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/teachers', '/specialist/students', '/director/staff'], async (me) => {
    const target = await db.user.findUnique({ where: { id: id.parse(f(fd, 'userId')) } });
    if (!target || target.schoolId !== me.schoolId || !canManage(me.role, target.role)) throw new Error('Дастрасӣ манъ аст.');
    const active = f(fd, 'active') === '1';
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { isActive: active } }),
      ...(active ? [] : [db.session.deleteMany({ where: { userId: target.id } })]),
    ]);
    await audit({ action: active ? 'user.activate' : 'user.deactivate', actorId: me.id, schoolId: me.schoolId, entity: 'User', entityId: target.id });
    return done(active ? 'Ҳисоб фаъол шуд.' : 'Ҳисоб ғайрифаъол шуд.');
  });
}

// ───────────────────────── Тақсими фан ва синф ─────────────────────────

export async function assignTeacher(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/teachers'], async (me) => {
    const teacher = own(await db.user.findUnique({ where: { id: id.parse(f(fd, 'teacherId')) } }), me.schoolId, 'Омӯзгор');
    if (teacher.role !== 'TEACHER') throw new Error('Ин корбар омӯзгор нест.');
    const subject = own(await db.subject.findUnique({ where: { id: id.parse(f(fd, 'subjectId')) } }), me.schoolId, 'Фан');
    const classIds = fd.getAll('classIds').map((v) => id.parse(v));
    if (!classIds.length) throw new Error('Камаш як синфро интихоб кунед.');
    const year = await currentYearOrThrow(me.schoolId);
    const classes = await db.class.findMany({ where: { id: { in: classIds }, schoolId: me.schoolId, academicYearId: year.id } });
    if (classes.length !== classIds.length) throw new Error('Синф ёфт нашуд.');
    const today = todayISO();
    let created = 0;
    for (const c of classes) {
      const dup = await db.teachingAssignment.findFirst({
        where: { teacherId: teacher.id, classId: c.id, subjectId: subject.id, OR: [{ activeTo: null }, { activeTo: { gte: toDbDate(today) } }] },
      });
      if (dup) continue;
      await db.teachingAssignment.create({
        data: { schoolId: me.schoolId, teacherId: teacher.id, classId: c.id, subjectId: subject.id, academicYearId: year.id, activeFrom: toDbDate(today) },
      });
      created++;
    }
    await audit({ action: 'assignment.create', actorId: me.id, schoolId: me.schoolId, details: { teacherId: teacher.id, subjectId: subject.id, classIds } });
    return done(`${teacher.fullName}: ${created} тақсимоти нав (${subject.name}).`);
  });
}

export async function endAssignment(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/teachers'], async (me) => {
    const a = own(await db.teachingAssignment.findUnique({ where: { id: id.parse(f(fd, 'assignmentId')) } }), me.schoolId, 'Тақсимот');
    // Дирӯз — то имрӯз омӯзгор дигар дастрасӣ надорад
    const y = new Date(toDbDate(todayISO()).getTime() - 86400000);
    await db.teachingAssignment.update({ where: { id: a.id }, data: { activeTo: y < a.activeFrom ? a.activeFrom : y } });
    await audit({ action: 'assignment.end', actorId: me.id, schoolId: me.schoolId, entity: 'TeachingAssignment', entityId: a.id });
    return done('Тақсимот қатъ шуд.');
  });
}

/** Интиқоли омӯзгор: ҳамаи синф/фанҳо ва ҷадвал ба омӯзгори нав мегузаранд; журнал бо синф мемонад */
export async function transferTeacher(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/teachers', '/specialist/schedule'], async (me) => {
    const fromId = id.parse(f(fd, 'fromId'));
    const toId = id.parse(f(fd, 'toId'));
    if (fromId === toId) throw new Error('Омӯзгорони гуногунро интихоб кунед.');
    const [from, to] = await Promise.all([db.user.findUnique({ where: { id: fromId } }), db.user.findUnique({ where: { id: toId } })]);
    if (!from || !to || from.schoolId !== me.schoolId || to.schoolId !== me.schoolId || from.role !== 'TEACHER' || to.role !== 'TEACHER') {
      throw new Error('Омӯзгор ёфт нашуд.');
    }
    const today = toDbDate(todayISO());
    const yesterday = new Date(today.getTime() - 86400000);
    const active = await db.teachingAssignment.findMany({ where: { teacherId: fromId, OR: [{ activeTo: null }, { activeTo: { gte: today } }] } });
    if (!active.length) throw new Error('Омӯзгор тақсимоти фаъол надорад.');
    await db.$transaction([
      ...active.map((a) => db.teachingAssignment.update({ where: { id: a.id }, data: { activeTo: yesterday < a.activeFrom ? a.activeFrom : yesterday } })),
      db.teachingAssignment.createMany({
        data: active.map((a) => ({ schoolId: me.schoolId, teacherId: toId, classId: a.classId, subjectId: a.subjectId, academicYearId: a.academicYearId, activeFrom: today })),
      }),
      db.scheduleLesson.updateMany({ where: { teacherId: fromId, schoolId: me.schoolId }, data: { teacherId: toId } }),
    ]);
    await audit({ action: 'teacher.transfer', actorId: me.id, schoolId: me.schoolId, details: { fromId, toId, assignments: active.length } });
    return done(`${active.length} тақсимот ва ҷадвал аз ${from.fullName} ба ${to.fullName} гузашт.`);
  });
}

// ───────────────────────── Хонандагон ва волидон ─────────────────────────

async function addOneStudent(
  me: { id: number; schoolId: number },
  input: { fullName: string; gender: string | null; classId: number; academicYearId: number; parentLogin?: string; parentName?: string; noParent?: boolean },
  parentMustChange: boolean,
): Promise<Credential | null> {
  // Волиди мавҷуда (ҳатто аз мактаби дигар) — танҳо пайваст
  let existingParent: { id: number } | null = null;
  if (input.parentLogin) {
    existingParent = await db.user.findFirst({ where: { login: input.parentLogin.trim().toLowerCase(), role: 'PARENT', isActive: true }, select: { id: true } });
    if (!existingParent) throw new Error(`Волид бо логини «${input.parentLogin}» ёфт нашуд.`);
  }
  return db.$transaction(async (tx) => {
    const student = await tx.student.create({ data: { schoolId: me.schoolId, fullName: input.fullName, gender: input.gender } });
    await tx.classEnrollment.create({ data: { schoolId: me.schoolId, studentId: student.id, classId: input.classId, academicYearId: input.academicYearId } });
    let cred: Credential | null = null;
    let parentId = existingParent?.id;
    if (!parentId && !input.noParent) {
      const parentName = input.parentName || `Волиди ${input.fullName}`;
      const acc = await createAccount({ role: 'PARENT', schoolId: me.schoolId, fullName: parentName, mustChangePassword: parentMustChange }, tx);
      parentId = acc.user.id;
      cred = { fullName: parentName, login: acc.login, password: acc.password, note: `Хонанда: ${input.fullName}` };
    }
    if (parentId) await tx.parentStudent.create({ data: { parentUserId: parentId, studentId: student.id, schoolId: me.schoolId } });
    await audit({ action: 'student.create', actorId: me.id, schoolId: me.schoolId, entity: 'Student', entityId: student.id, details: { fullName: input.fullName, classId: input.classId, parentId: parentId ?? null } }, tx);
    return cred;
  }, { timeout: 15000 });
}

export async function createStudent(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/students'], async (me) => {
    const ctx = await schoolContext(me.schoolId);
    if (!ctx.year) throw new Error('Аввал соли таҳсилро созед.');
    const cls = own(await db.class.findUnique({ where: { id: id.parse(f(fd, 'classId')) } }), me.schoolId, 'Синф');
    const fullName = cleanName(str(150).parse(f(fd, 'fullName')));
    const gender = ['M', 'F'].includes(f(fd, 'gender')) ? f(fd, 'gender') : null;
    const cred = await addOneStudent(
      me,
      { fullName, gender, classId: cls.id, academicYearId: cls.academicYearId, parentLogin: f(fd, 'parentLogin') || undefined, parentName: cleanName(f(fd, 'parentName')) || undefined },
      ctx.settings.parentMustChangePassword,
    );
    return done(`${fullName} ба ${cls.name} илова шуд.`, cred ? [cred] : undefined);
  });
}

/** Якбора: ҳар сатр — ному насаби хонанда; барои ҳар кас ҳисоби волид сохта мешавад */
export async function createStudentsBulk(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/students'], async (me) => {
    const ctx = await schoolContext(me.schoolId);
    const cls = own(await db.class.findUnique({ where: { id: id.parse(f(fd, 'classId')) } }), me.schoolId, 'Синф');
    const names = f(fd, 'names').split('\n').map(cleanName).filter(Boolean);
    if (!names.length) throw new Error('Номҳоро нависед.');
    if (names.length > 25) throw new Error('Дар як бор то 25 нафар (сервери ройгон вақти маҳдуд дорад).');
    const creds: Credential[] = [];
    for (const fullName of names) {
      const c = await addOneStudent(me, { fullName, gender: null, classId: cls.id, academicYearId: cls.academicYearId }, ctx.settings.parentMustChangePassword);
      if (c) creds.push(c);
    }
    return done(`${names.length} хонанда ба ${cls.name} илова шуд.`, creds);
  });
}

export async function linkParent(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/students'], async (me) => {
    const st = own(await db.student.findUnique({ where: { id: id.parse(f(fd, 'studentId')) } }), me.schoolId, 'Хонанда');
    const login = str(64).parse(f(fd, 'parentLogin')).toLowerCase();
    const parent = await db.user.findFirst({ where: { login, role: 'PARENT' } });
    if (!parent) throw new Error('Волид ёфт нашуд.');
    await db.parentStudent.upsert({
      where: { parentUserId_studentId: { parentUserId: parent.id, studentId: st.id } },
      create: { parentUserId: parent.id, studentId: st.id, schoolId: me.schoolId },
      update: {},
    });
    await audit({ action: 'parent.link', actorId: me.id, schoolId: me.schoolId, entity: 'Student', entityId: st.id, details: { parentId: parent.id } });
    return done(`${parent.fullName} ба ${st.fullName} пайваст шуд.`);
  });
}

export async function newParentAccount(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/students'], async (me) => {
    const st = own(await db.student.findUnique({ where: { id: id.parse(f(fd, 'studentId')) } }), me.schoolId, 'Хонанда');
    const ctx = await schoolContext(me.schoolId);
    const fullName = cleanName(f(fd, 'parentName')) || `Волиди ${st.fullName}`;
    const acc = await createAccount({ role: 'PARENT', schoolId: me.schoolId, fullName, mustChangePassword: ctx.settings.parentMustChangePassword });
    await db.parentStudent.create({ data: { parentUserId: acc.user.id, studentId: st.id, schoolId: me.schoolId } });
    await audit({ action: 'user.create', actorId: me.id, schoolId: me.schoolId, entity: 'User', entityId: acc.user.id, details: { role: 'PARENT', studentId: st.id } });
    return done('Ҳисоби волид сохта шуд.', [{ fullName, login: acc.login, password: acc.password, note: `Хонанда: ${st.fullName}` }]);
  });
}

export async function updateStudent(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/students'], async (me) => {
    const st = own(await db.student.findUnique({ where: { id: id.parse(f(fd, 'studentId')) } }), me.schoolId, 'Хонанда');
    const status = z.enum(['ACTIVE', 'ABROAD', 'EXPELLED', 'GRADUATED']).parse(f(fd, 'status'));
    const fullName = cleanName(str(150).parse(f(fd, 'fullName')));
    const gender = ['M', 'F'].includes(f(fd, 'gender')) ? f(fd, 'gender') : null;
    const classId = f(fd, 'classId') ? id.parse(f(fd, 'classId')) : null;
    const year = await currentYearOrThrow(me.schoolId);
    await db.$transaction(async (tx) => {
      await tx.student.update({ where: { id: st.id }, data: { status, fullName, gender } });
      if (classId) {
        const cls = own(await tx.class.findUnique({ where: { id: classId } }), me.schoolId, 'Синф');
        if (cls.academicYearId !== year.id) throw new Error('Синф аз соли ҷорӣ нест.');
        await tx.classEnrollment.upsert({
          where: { studentId_academicYearId: { studentId: st.id, academicYearId: year.id } },
          create: { schoolId: me.schoolId, studentId: st.id, classId: cls.id, academicYearId: year.id },
          update: { classId: cls.id },
        });
      }
    });
    await audit({ action: 'student.update', actorId: me.id, schoolId: me.schoolId, entity: 'Student', entityId: st.id, details: { old: { status: st.status, fullName: st.fullName }, new: { status, fullName, classId } } });
    return done('Маълумоти хонанда нав шуд.');
  });
}

// ───────────────────────── Ҷадвали дарсҳо ─────────────────────────

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function addLesson(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/schedule'], async (me) => {
    const cls = own(await db.class.findUnique({ where: { id: id.parse(f(fd, 'classId')) } }), me.schoolId, 'Синф');
    const subject = own(await db.subject.findUnique({ where: { id: id.parse(f(fd, 'subjectId')) } }), me.schoolId, 'Фан');
    const teacher = await db.user.findUnique({ where: { id: id.parse(f(fd, 'teacherId')) } });
    if (!teacher || teacher.schoolId !== me.schoolId || teacher.role !== 'TEACHER') throw new Error('Омӯзгор ёфт нашуд.');
    const weekday = z.coerce.number().int().min(1).max(6).parse(f(fd, 'weekday'));
    const lessonNo = z.coerce.number().int().min(1).max(12).parse(f(fd, 'lessonNo'));
    const startTime = z.string().regex(timeRe, 'Вақт мисли 08:00').parse(f(fd, 'startTime'));
    const endTime = z.string().regex(timeRe, 'Вақт мисли 08:45').parse(f(fd, 'endTime'));
    if (startTime >= endTime) throw new Error('Вақти оғоз бояд пеш аз анҷом бошад.');
    const busy = await db.scheduleLesson.findFirst({ where: { teacherId: teacher.id, weekday, lessonNo, NOT: { classId: cls.id } }, include: { class: true } });
    if (busy) throw new Error(`${teacher.fullName} дар ин соат дар ${busy.class.name} дарс дорад.`);
    const assigned = await db.teachingAssignment.findFirst({ where: { teacherId: teacher.id, classId: cls.id, subjectId: subject.id, activeTo: null } });
    await db.scheduleLesson.upsert({
      where: { classId_weekday_lessonNo: { classId: cls.id, weekday, lessonNo } },
      create: { schoolId: me.schoolId, classId: cls.id, subjectId: subject.id, teacherId: teacher.id, weekday, lessonNo, startTime, endTime },
      update: { subjectId: subject.id, teacherId: teacher.id, startTime, endTime },
    });
    await audit({ action: 'schedule.set', actorId: me.id, schoolId: me.schoolId, details: { classId: cls.id, weekday, lessonNo, subjectId: subject.id, teacherId: teacher.id } });
    return done(assigned ? 'Дарс сабт шуд.' : 'Дарс сабт шуд. Диққат: ин омӯзгор ба ин синф/фан тақсим нашудааст — дар «Омӯзгорон» тақсим кунед.');
  });
}

export async function deleteLesson(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/schedule'], async (me) => {
    const l = own(await db.scheduleLesson.findUnique({ where: { id: id.parse(f(fd, 'lessonId')) } }), me.schoolId, 'Дарс');
    await db.scheduleLesson.delete({ where: { id: l.id } });
    await audit({ action: 'schedule.delete', actorId: me.id, schoolId: me.schoolId, entity: 'ScheduleLesson', entityId: l.id, details: { classId: l.classId, weekday: l.weekday, lessonNo: l.lessonNo } });
    return done('Дарс нест карда шуд.');
  });
}

// ───────────────────────── Дархостҳои тасҳеҳ ─────────────────────────

const valueSchema = z.object({
  grade: z.number().int().min(1).max(10).nullable(),
  attendance: z.enum(['PRESENT', 'ABSENT', 'EXCUSED']),
  behavior: z.enum(['EXEMPLARY', 'SATISFACTORY', 'UNSATISFACTORY']).nullable(),
});

export async function reviewCorrection(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/corrections', '/specialist'], async (me) => {
    const c = own(await db.gradeCorrection.findUnique({ where: { id: id.parse(f(fd, 'correctionId')) } }), me.schoolId, 'Дархост');
    if (c.status !== 'PENDING') throw new Error('Дархост аллакай баррасӣ шудааст.');
    const approve = f(fd, 'decision') === 'approve';
    if (!approve) {
      await db.gradeCorrection.update({ where: { id: c.id }, data: { status: 'REJECTED', reviewedById: me.id, reviewedAt: new Date() } });
      await audit({ action: 'correction.reject', actorId: me.id, schoolId: me.schoolId, entity: 'GradeCorrection', entityId: c.id });
      return done('Дархост рад шуд.');
    }
    const v = valueSchema.parse(c.newValue);
    const value = { grade: v.attendance === 'PRESENT' ? v.grade : null, attendance: v.attendance, behavior: v.behavior };
    await db.$transaction(async (tx) => {
      if (c.journalEntryId) {
        await tx.journalEntry.update({ where: { id: c.journalEntryId }, data: value });
      } else {
        const exists = await tx.journalEntry.findUnique({
          where: { studentId_subjectId_lessonDate_lessonNo: { studentId: c.studentId, subjectId: c.subjectId, lessonDate: c.lessonDate, lessonNo: c.lessonNo } },
        });
        if (exists) await tx.journalEntry.update({ where: { id: exists.id }, data: value });
        else
          await tx.journalEntry.create({
            data: { schoolId: me.schoolId, studentId: c.studentId, classId: c.classId, subjectId: c.subjectId, enteredById: c.requestedById, lessonDate: c.lessonDate, lessonNo: c.lessonNo, ...value },
          });
      }
      await tx.gradeCorrection.update({ where: { id: c.id }, data: { status: 'APPROVED', reviewedById: me.id, reviewedAt: new Date() } });
      await audit({ action: 'correction.approve', actorId: me.id, schoolId: me.schoolId, entity: 'GradeCorrection', entityId: c.id, details: { old: c.oldValue ?? null, new: value } }, tx);
    });
    return done('Дархост тасдиқ шуд ва журнал нав шуд.');
  });
}

// ───────────────────────── Ҳуҷҷатҳои «сабабнок» ─────────────────────────

export async function createExcuse(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/excuses'], async (me) => {
    const st = own(await db.student.findUnique({ where: { id: id.parse(f(fd, 'studentId')) } }), me.schoolId, 'Хонанда');
    const from = isoDate.parse(f(fd, 'dateFrom'));
    const to = isoDate.parse(f(fd, 'dateTo'));
    if (from > to) throw new Error('Санаи оғоз баъд аз анҷом аст.');
    const note = f(fd, 'note').trim().slice(0, 500) || null;
    const approve = f(fd, 'decision') !== 'reject';
    let fileKey: string | null = null;
    const file = fd.get('file');
    if (file instanceof File && file.size > 0) {
      if (!storageEnabled) throw new Error('Боркунии файл танзим нашудааст — танҳо тавзеҳ нависед.');
      fileKey = `${me.schoolId}/${st.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
      await uploadFile(fileKey, file);
    }
    const result = await db.$transaction(async (tx) => {
      const doc = await tx.excuseDocument.create({
        data: { schoolId: me.schoolId, studentId: st.id, dateFrom: toDbDate(from), dateTo: toDbDate(to), note, fileKey, status: approve ? 'APPROVED' : 'REJECTED', reviewedById: me.id },
      });
      let changed = 0;
      if (approve) {
        const r = await tx.journalEntry.updateMany({
          where: { schoolId: me.schoolId, studentId: st.id, attendance: 'ABSENT', lessonDate: { gte: toDbDate(from), lte: toDbDate(to) } },
          data: { attendance: 'EXCUSED' },
        });
        changed = r.count;
      }
      await audit({ action: approve ? 'excuse.approve' : 'excuse.reject', actorId: me.id, schoolId: me.schoolId, entity: 'ExcuseDocument', entityId: doc.id, details: { studentId: st.id, from, to, changed } }, tx);
      return changed;
    });
    return done(approve ? `Тасдиқ шуд. ${result} «нест» ба «сабабнок» иваз шуд.` : 'Ҳуҷҷат рад шуд.');
  });
}

// ───────────────────────── Баҳои имтиҳон ─────────────────────────

export async function setExamGrades(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/grades'], async (me) => {
    const cls = own(await db.class.findUnique({ where: { id: id.parse(f(fd, 'classId')) } }), me.schoolId, 'Синф');
    const subject = own(await db.subject.findUnique({ where: { id: id.parse(f(fd, 'subjectId')) } }), me.schoolId, 'Фан');
    const enr = await db.classEnrollment.findMany({ where: { classId: cls.id }, select: { studentId: true } });
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let n = 0;
    for (const { studentId } of enr) {
      const raw = f(fd, `exam_${studentId}`);
      if (raw === '') {
        ops.push(db.periodGrade.deleteMany({ where: { studentId, subjectId: subject.id, academicYearId: cls.academicYearId, kind: 'EXAM' } }));
        continue;
      }
      const value = z.coerce.number().int().min(1).max(10).parse(raw);
      n++;
      ops.push(
        db.periodGrade.upsert({
          where: { studentId_subjectId_academicYearId_kind: { studentId, subjectId: subject.id, academicYearId: cls.academicYearId, kind: 'EXAM' } },
          create: { schoolId: me.schoolId, studentId, subjectId: subject.id, academicYearId: cls.academicYearId, kind: 'EXAM', value },
          update: { value, computedAt: new Date() },
        }),
      );
    }
    await db.$transaction(ops);
    await audit({ action: 'exam.set', actorId: me.id, schoolId: me.schoolId, details: { classId: cls.id, subjectId: subject.id, count: n } });
    return done(`${n} баҳои имтиҳон сабт шуд.`);
  });
}

// ───────────────────────── Охири соли таҳсил ─────────────────────────

export async function saveYearResults(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/year-end'], async (me) => {
    const cls = own(await db.class.findUnique({ where: { id: id.parse(f(fd, 'classId')) } }), me.schoolId, 'Синф');
    const enr = await db.classEnrollment.findMany({ where: { classId: cls.id } });
    const R = z.enum(['PROMOTED', 'REPEATED', 'EXPELLED', 'GRADUATED']);
    await db.$transaction(enr.map((e) => db.classEnrollment.update({ where: { id: e.id }, data: { yearResult: R.parse(f(fd, `r_${e.id}`)) } })));
    await audit({ action: 'year.results', actorId: me.id, schoolId: me.schoolId, details: { classId: cls.id, count: enr.length } });
    return done(`Натиҷаҳои ${cls.name} сабт шуд.`);
  });
}

/**
 * Гузариш ба соли нав: баҳои солона сабт мешавад, синфҳои нав сохта мешаванд,
 * хонандагон аз рӯи натиҷа мегузаранд, соли кӯҳна баста мешавад (таърих боқӣ мемонад).
 */
export async function startNewYear(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/year-end', '/specialist/years', '/specialist/classes'], async (me) => {
    const ctx = await schoolContext(me.schoolId);
    const old = ctx.year;
    if (!old) throw new Error('Соли ҷорӣ нест.');
    const name = str(20).regex(/^\d{4}-\d{4}$/, 'Ном мисли 2027-2028').parse(f(fd, 'name'));
    const qs = quartersFrom(fd);
    const copyAssignments = f(fd, 'copyAssignments') === 'on';

    const classes = await db.class.findMany({ where: { academicYearId: old.id }, include: { enrollments: { include: { student: true } } } });
    const missing = classes.flatMap((c) => c.enrollments.filter((e) => !e.yearResult && e.student.status === 'ACTIVE').map(() => c.name));
    if (missing.length) throw new Error(`Натиҷаи сол барои синфҳо пур нашудааст: ${[...new Set(missing)].join(', ')}`);

    // 1) Баҳои солона (snapshot)
    const quarterRanges = ctx.quarters.map((q) => ({ number: q.number, start: q.start, end: q.end }));
    const entries = await db.journalEntry.findMany({
      where: { schoolId: me.schoolId, class: { academicYearId: old.id }, grade: { not: null } },
      select: { studentId: true, subjectId: true, grade: true, lessonDate: true },
    });
    const exams = await db.periodGrade.findMany({ where: { academicYearId: old.id, kind: 'EXAM' } });
    const examMap = new Map<string, number | null>(exams.map((e) => [`${e.studentId}:${e.subjectId}`, e.value] as const));
    const groups = new Map<string, { date: string; grade: number | null }[]>();
    for (const e of entries) {
      const k = `${e.studentId}:${e.subjectId}`;
      const arr = groups.get(k) ?? ([] as { date: string; grade: number | null }[]);
      arr.push({ date: isoOf(e.lessonDate), grade: e.grade });
      groups.set(k, arr);
    }
    const annualRows = [...groups.entries()].map(([k, rows]) => {
      const [studentId, subjectId] = k.split(':').map(Number);
      const r = computePeriods(rows, quarterRanges, examMap.get(k) ?? null, ctx.settings.examWeightPercent);
      return { schoolId: me.schoolId, studentId, subjectId, academicYearId: old.id, kind: 'ANNUAL' as const, value: r.annual };
    });

    await db.$transaction(
      async (tx) => {
        await tx.periodGrade.deleteMany({ where: { academicYearId: old.id, kind: 'ANNUAL' } });
        if (annualRows.length) await tx.periodGrade.createMany({ data: annualRows });

        // 2) Соли нав
        await tx.academicYear.updateMany({ where: { schoolId: me.schoolId }, data: { isCurrent: false } });
        await tx.academicYear.update({ where: { id: old.id }, data: { isClosed: true } });
        const ny = await tx.academicYear.create({
          data: {
            schoolId: me.schoolId, name, startDate: toDbDate(qs[0].start), endDate: toDbDate(qs[3].end), isCurrent: true,
            quarters: { create: qs.map((q) => ({ schoolId: me.schoolId, number: q.number, startDate: toDbDate(q.start), endDate: toDbDate(q.end) })) },
          },
        });

        // 3) Синфҳои нав ва гузаронидани хонандагон
        const classCache = new Map<string, number>();
        const ensureClass = async (gradeLevel: number, letter: string) => {
          const cname = letter ? `${gradeLevel}-${letter}` : String(gradeLevel);
          const cached = classCache.get(cname);
          if (cached) return cached;
          const c = await tx.class.upsert({
            where: { schoolId_academicYearId_name: { schoolId: me.schoolId, academicYearId: ny.id, name: cname } },
            create: { schoolId: me.schoolId, academicYearId: ny.id, gradeLevel, letter, name: cname },
            update: {},
          });
          classCache.set(cname, c.id);
          return c.id;
        };
        for (const c of classes) {
          if (c.gradeLevel < 11) await ensureClass(c.gradeLevel + 1, c.letter);
          for (const e of c.enrollments) {
            if (e.student.status !== 'ACTIVE' && e.student.status !== 'ABROAD') continue;
            const result = e.yearResult ?? (c.gradeLevel >= 11 ? 'GRADUATED' : 'PROMOTED');
            if (result === 'PROMOTED' && c.gradeLevel < 11) {
              const nc = await ensureClass(c.gradeLevel + 1, c.letter);
              await tx.classEnrollment.create({ data: { schoolId: me.schoolId, studentId: e.studentId, classId: nc, academicYearId: ny.id } });
            } else if (result === 'REPEATED') {
              const nc = await ensureClass(c.gradeLevel, c.letter);
              await tx.classEnrollment.create({ data: { schoolId: me.schoolId, studentId: e.studentId, classId: nc, academicYearId: ny.id } });
            } else if (result === 'EXPELLED') {
              await tx.student.update({ where: { id: e.studentId }, data: { status: 'EXPELLED' } });
            } else {
              await tx.student.update({ where: { id: e.studentId }, data: { status: 'GRADUATED' } });
            }
          }
        }
        // Синфҳои 1-ум барои қабули нав
        for (const c of classes.filter((x) => x.gradeLevel === 1)) await ensureClass(1, c.letter);

        // 4) Нусхаи тақсимот (ихтиёрӣ): омӯзгори 5-А → 6-А
        if (copyAssignments) {
          const today = toDbDate(qs[0].start);
          const olds = await tx.teachingAssignment.findMany({ where: { academicYearId: old.id, activeTo: null }, include: { class: true } });
          for (const a of olds) {
            if (a.class.gradeLevel >= 11) continue;
            const nc = await ensureClass(a.class.gradeLevel + 1, a.class.letter);
            await tx.teachingAssignment.create({ data: { schoolId: me.schoolId, teacherId: a.teacherId, classId: nc, subjectId: a.subjectId, academicYearId: ny.id, activeFrom: today } });
          }
        }
        await tx.teachingAssignment.updateMany({ where: { academicYearId: old.id, activeTo: null }, data: { activeTo: old.endDate } });
        await tx.scheduleLesson.deleteMany({ where: { schoolId: me.schoolId } });
        await audit({ action: 'year.transition', actorId: me.id, schoolId: me.schoolId, entity: 'AcademicYear', entityId: ny.id, details: { from: old.name, to: name, annual: annualRows.length } }, tx);
      },
      { timeout: 60000 },
    );
    return done(`Соли ${name} оғоз шуд. Баҳои солона сабт ва хонандагон гузаронида шуданд. Ҷадвали дарсҳоро нав созед.`);
  });
}

// ───────────────────────── Танзимот ─────────────────────────

export async function updateSettings(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/settings'], async (me) => {
    const data = {
      parentMustChangePassword: f(fd, 'parentMustChangePassword') === 'on',
      maxLoginAttempts: z.coerce.number().int().min(3).max(20).parse(f(fd, 'maxLoginAttempts')),
      lockMinutes: z.coerce.number().int().min(1).max(1440).parse(f(fd, 'lockMinutes')),
      examWeightPercent: z.coerce.number().int().min(0).max(100).parse(f(fd, 'examWeightPercent')),
      allowParentSignup: f(fd, 'allowParentSignup') === 'on',
    };
    await db.schoolSettings.upsert({ where: { schoolId: me.schoolId }, create: { schoolId: me.schoolId, ...data }, update: data });
    await audit({ action: 'settings.update', actorId: me.id, schoolId: me.schoolId, details: data });
    return done('Танзимот сабт шуд.');
  });
}

// ───────────────────────── Таҳрир ва нест кардан ─────────────────────────

/** Омӯзгори нав бо фан ва синфҳо дар як вақт */
export async function createTeacherWithAssignments(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/teachers', '/specialist'], async (me) => {
    const fullName = cleanName(z.string().min(3, 'Ному насабро пурра нависед.').max(150).parse(f(fd, 'fullName')));
    const year = await currentYearOrThrow(me.schoolId);
    const subjectId = f(fd, 'subjectId') ? id.parse(f(fd, 'subjectId')) : null;
    const classIds = fd.getAll('classIds').map((v) => id.parse(v));
    if (classIds.length && !subjectId) throw new Error('Барои синфҳо фанро интихоб кунед.');
    if (subjectId) own(await db.subject.findUnique({ where: { id: subjectId } }), me.schoolId, 'Фан');
    const classes = classIds.length ? await db.class.findMany({ where: { id: { in: classIds }, schoolId: me.schoolId, academicYearId: year.id } }) : [];
    if (classes.length !== classIds.length) throw new Error('Синф ёфт нашуд.');
    const rawPhone = f(fd, 'phone').trim();
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) throw new Error('Рақамро дуруст нависед (мисол: 90 123 45 67).');
    if (phone && (await db.user.findFirst({ where: { OR: [{ phone }, { login: phone }] }, select: { id: true } }))) throw new Error('Ин рақам ба ҳисоби дигар пайваст аст.');
    const { user, login, password } = await createAccount({ role: 'TEACHER', schoolId: me.schoolId, fullName, mustChangePassword: true });
    if (phone) await db.user.update({ where: { id: user.id }, data: { phone } });
    if (subjectId && classes.length) {
      await db.teachingAssignment.createMany({
        data: classes.map((c) => ({ schoolId: me.schoolId, teacherId: user.id, classId: c.id, subjectId, academicYearId: year.id, activeFrom: toDbDate(todayISO()) })),
      });
    }
    await audit({ action: 'user.create', actorId: me.id, schoolId: me.schoolId, entity: 'User', entityId: user.id, details: { role: 'TEACHER', fullName, subjectId, classIds } });
    return done(`${fullName} илова шуд${classes.length ? ` ва ${classes.length} синф вобаста шуд` : ''}.`, [{ fullName, login, password }]);
  });
}

/** Иваз кардани ному насаби омӯзгор (ё волид) */
export async function renameUser(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/teachers', '/specialist/students'], async (me) => {
    const target = await db.user.findUnique({ where: { id: id.parse(f(fd, 'userId')) } });
    if (!target || target.schoolId !== me.schoolId || !canManage(me.role, target.role)) throw new Error('Дастрасӣ манъ аст.');
    const fullName = cleanName(z.string().min(3).max(150).parse(f(fd, 'fullName')));
    const data: { fullName: string; phone?: string | null } = { fullName };
    if (fd.has('phone')) {
      const raw = f(fd, 'phone').trim();
      const phone = raw ? normalizePhone(raw) : null;
      if (raw && !phone) throw new Error('Рақамро дуруст нависед (мисол: 90 123 45 67).');
      if (phone && phone !== target.phone) {
        const taken = await db.user.findFirst({ where: { OR: [{ phone }, { login: phone }], NOT: { id: target.id } }, select: { id: true } });
        if (taken) throw new Error('Ин рақам ба ҳисоби дигар пайваст аст.');
      }
      if (!phone && target.login === target.phone) throw new Error('Корбар бо ҳамин рақам ворид мешавад — онро холӣ кардан мумкин нест.');
      data.phone = phone;
    }
    await db.user.update({ where: { id: target.id }, data });
    await audit({ action: 'user.rename', actorId: me.id, schoolId: me.schoolId, entity: 'User', entityId: target.id, details: { old: target.fullName, new: fullName, phone: data.phone !== undefined ? 'updated' : 'same' } });
    return done('Сабт шуд.');
  });
}

/**
 * Нест кардани омӯзгор. Агар ӯ ҳанӯз чизе сабт накарда бошад — пурра нест мешавад.
 * Агар баҳо гузошта ё ворид шуда бошад — ба бойгонӣ меравад (таърихи журнал бояд боқӣ монад):
 * ҳисоб баста, тақсимот ва ҷадвал гирифта мешаванд.
 */
export async function deleteTeacher(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/teachers', '/specialist/schedule', '/specialist'], async (me) => {
    const t = await db.user.findUnique({ where: { id: id.parse(f(fd, 'userId')) } });
    if (!t || t.schoolId !== me.schoolId || t.role !== 'TEACHER' || !canManage(me.role, t.role)) throw new Error('Омӯзгор ёфт нашуд.');
    const [entries, corr, logs] = await Promise.all([
      db.journalEntry.count({ where: { enteredById: t.id } }),
      db.gradeCorrection.count({ where: { requestedById: t.id } }),
      db.auditLog.count({ where: { actorId: t.id } }),
    ]);
    if (entries + corr + logs === 0) {
      await db.$transaction([
        db.scheduleLesson.deleteMany({ where: { teacherId: t.id } }),
        db.teachingAssignment.deleteMany({ where: { teacherId: t.id } }),
        db.session.deleteMany({ where: { userId: t.id } }),
        db.user.delete({ where: { id: t.id } }),
      ]);
      await audit({ action: 'user.delete', actorId: me.id, schoolId: me.schoolId, entity: 'User', entityId: t.id, details: { fullName: t.fullName } });
      return done(`${t.fullName} пурра нест карда шуд.`);
    }
    const y = new Date(toDbDate(todayISO()).getTime() - 86400000);
    await db.$transaction([
      db.scheduleLesson.deleteMany({ where: { teacherId: t.id } }),
      db.teachingAssignment.updateMany({ where: { teacherId: t.id, OR: [{ activeTo: null }, { activeTo: { gt: y } }] }, data: { activeTo: y } }),
      db.session.deleteMany({ where: { userId: t.id } }),
      db.user.update({ where: { id: t.id }, data: { isActive: false } }),
    ]);
    await audit({ action: 'user.archive', actorId: me.id, schoolId: me.schoolId, entity: 'User', entityId: t.id, details: { fullName: t.fullName, entries } });
    return done(`${t.fullName} ба бойгонӣ гузашт: ҳисоб баста шуд, синфҳо ва ҷадвал гирифта шуданд. Баҳоҳое, ки гузоштааст, дар журнал боқӣ мемонанд.`);
  });
}

/** Иваз кардани фан ё синфи тақсимот */
export async function updateAssignment(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/teachers', '/specialist/schedule'], async (me) => {
    const a = own(await db.teachingAssignment.findUnique({ where: { id: id.parse(f(fd, 'assignmentId')) } }), me.schoolId, 'Тақсимот');
    const cls = own(await db.class.findUnique({ where: { id: id.parse(f(fd, 'classId')) } }), me.schoolId, 'Синф');
    const subject = own(await db.subject.findUnique({ where: { id: id.parse(f(fd, 'subjectId')) } }), me.schoolId, 'Фан');
    if (cls.academicYearId !== a.academicYearId) throw new Error('Синф аз ҳамин соли таҳсил бояд бошад.');
    if (cls.id === a.classId && subject.id === a.subjectId) return done('Тағйир нест.');
    const dup = await db.teachingAssignment.findFirst({ where: { teacherId: a.teacherId, classId: cls.id, subjectId: subject.id, activeTo: null, NOT: { id: a.id } } });
    if (dup) throw new Error('Ин фан ва синф аллакай ба омӯзгор вобаста аст.');
    let removed = 0;
    await db.$transaction(async (tx) => {
      if (cls.id === a.classId) {
        await tx.scheduleLesson.updateMany({ where: { teacherId: a.teacherId, classId: a.classId, subjectId: a.subjectId }, data: { subjectId: subject.id } });
      } else {
        removed = (await tx.scheduleLesson.deleteMany({ where: { teacherId: a.teacherId, classId: a.classId, subjectId: a.subjectId } })).count;
      }
      await tx.teachingAssignment.update({ where: { id: a.id }, data: { classId: cls.id, subjectId: subject.id } });
      await audit({ action: 'assignment.update', actorId: me.id, schoolId: me.schoolId, entity: 'TeachingAssignment', entityId: a.id, details: { old: { classId: a.classId, subjectId: a.subjectId }, new: { classId: cls.id, subjectId: subject.id } } }, tx);
    });
    return done(removed ? `Тағйир ёфт. ${removed} дарси ҷадвали синфи пешина гирифта шуд — ҷадвалро барои синфи нав гузоред.` : 'Тағйир ёфт.');
  });
}

/** Нест кардани тақсимот (журнал бо синф мемонад; дарсҳои ҷадвали ин омӯзгор дар ин синф/фан гирифта мешаванд) */
export async function deleteAssignment(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/teachers', '/specialist/schedule'], async (me) => {
    const a = own(await db.teachingAssignment.findUnique({ where: { id: id.parse(f(fd, 'assignmentId')) }, include: { class: true, subject: true } }), me.schoolId, 'Тақсимот');
    await db.$transaction([
      db.scheduleLesson.deleteMany({ where: { teacherId: a.teacherId, classId: a.classId, subjectId: a.subjectId } }),
      db.teachingAssignment.delete({ where: { id: a.id } }),
    ]);
    await audit({ action: 'assignment.delete', actorId: me.id, schoolId: me.schoolId, entity: 'TeachingAssignment', entityId: a.id, details: { teacherId: a.teacherId, class: a.class.name, subject: a.subject.name } });
    return done(`${a.subject.name} · ${a.class.name} аз омӯзгор гирифта шуд.`);
  });
}

/** Нест кардани фан — танҳо агар дар журнал баҳо надошта бошад */
export async function deleteSubject(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/subjects', '/specialist/teachers', '/specialist/schedule'], async (me) => {
    const s = own(await db.subject.findUnique({ where: { id: id.parse(f(fd, 'subjectId')) } }), me.schoolId, 'Фан');
    const [entries, periods] = await Promise.all([
      db.journalEntry.count({ where: { subjectId: s.id } }),
      db.periodGrade.count({ where: { subjectId: s.id } }),
    ]);
    if (entries + periods > 0) throw new Error(`«${s.name}» дар журнал ${entries} сабт дорад — нест кардан мумкин нест (таърих бояд боқӣ монад). Номашро иваз кунед ё тақсимотро гиред.`);
    await db.$transaction([
      db.scheduleLesson.deleteMany({ where: { subjectId: s.id } }),
      db.teachingAssignment.deleteMany({ where: { subjectId: s.id } }),
      db.subject.delete({ where: { id: s.id } }),
    ]);
    await audit({ action: 'subject.delete', actorId: me.id, schoolId: me.schoolId, entity: 'Subject', entityId: s.id, details: { name: s.name } });
    return done(`«${s.name}» нест карда шуд.`);
  });
}

/** Иваз кардани номи синф */
export async function renameClass(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/classes', '/specialist/students'], async (me) => {
    const c = own(await db.class.findUnique({ where: { id: id.parse(f(fd, 'classId')) } }), me.schoolId, 'Синф');
    const n = normalizeClassName(f(fd, 'name'));
    if (!n) throw new Error('Номи нодуруст (мисол: 5-А, 10б).');
    const clash = await db.class.findFirst({ where: { schoolId: me.schoolId, academicYearId: c.academicYearId, name: n.name, NOT: { id: c.id } } });
    if (clash) throw new Error(`Синфи ${n.name} аллакай ҳаст.`);
    await db.class.update({ where: { id: c.id }, data: { gradeLevel: n.gradeLevel, letter: n.letter, name: n.name } });
    await audit({ action: 'class.rename', actorId: me.id, schoolId: me.schoolId, entity: 'Class', entityId: c.id, details: { old: c.name, new: n.name } });
    return done(`${c.name} → ${n.name}`);
  });
}

/** Нест кардани синф — танҳо агар холӣ бошад */
export async function deleteClass(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/classes', '/specialist/teachers', '/specialist/schedule'], async (me) => {
    const c = own(await db.class.findUnique({ where: { id: id.parse(f(fd, 'classId')) } }), me.schoolId, 'Синф');
    const [students, entries] = await Promise.all([
      db.classEnrollment.count({ where: { classId: c.id } }),
      db.journalEntry.count({ where: { classId: c.id } }),
    ]);
    if (students) throw new Error(`Дар ${c.name} ${students} хонанда ҳаст. Аввал онҳоро ба синфи дигар гузаронед ё нест кунед.`);
    if (entries) throw new Error(`${c.name} дар журнал сабт дорад — нест кардан мумкин нест.`);
    await db.$transaction([
      db.scheduleLesson.deleteMany({ where: { classId: c.id } }),
      db.teachingAssignment.deleteMany({ where: { classId: c.id } }),
      db.class.delete({ where: { id: c.id } }),
    ]);
    await audit({ action: 'class.delete', actorId: me.id, schoolId: me.schoolId, entity: 'Class', entityId: c.id, details: { name: c.name } });
    return done(`${c.name} нест карда шуд.`);
  });
}

/**
 * Нест кардани хонанда — танҳо агар ҳанӯз баҳо/давомот надошта бошад (масалан, хато ворид шуда бошад).
 * Агар дар журнал сабт дошта бошад — ҳолатро «Хориҷ шуд» кунед, то таърих боқӣ монад.
 */
export async function deleteStudent(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/students', '/specialist'], async (me) => {
    const st = own(await db.student.findUnique({ where: { id: id.parse(f(fd, 'studentId')) } }), me.schoolId, 'Хонанда');
    const [entries, periods, docs] = await Promise.all([
      db.journalEntry.count({ where: { studentId: st.id } }),
      db.periodGrade.count({ where: { studentId: st.id } }),
      db.excuseDocument.count({ where: { studentId: st.id } }),
    ]);
    if (entries + periods + docs > 0) {
      throw new Error(`${st.fullName} дар журнал ${entries} сабт дорад. Нест кардан мумкин нест — ҳолатро «Хориҷ шуд» интихоб кунед.`);
    }
    await db.$transaction([
      db.parentLinkRequest.deleteMany({ where: { studentId: st.id } }),
      db.parentStudent.deleteMany({ where: { studentId: st.id } }),
      db.classEnrollment.deleteMany({ where: { studentId: st.id } }),
      db.student.delete({ where: { id: st.id } }),
    ]);
    await audit({ action: 'student.delete', actorId: me.id, schoolId: me.schoolId, entity: 'Student', entityId: st.id, details: { fullName: st.fullName } });
    return done(`${st.fullName} нест карда шуд.`);
  });
}

/** Ҷудо кардани волид аз хонанда (масалан, хато пайваст шуда бошад) */
export async function unlinkParent(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/students'], async (me) => {
    const studentId = id.parse(f(fd, 'studentId'));
    const parentUserId = id.parse(f(fd, 'parentId'));
    const link = await db.parentStudent.findUnique({ where: { parentUserId_studentId: { parentUserId, studentId } } });
    if (!link || link.schoolId !== me.schoolId) throw new Error('Пайваст ёфт нашуд.');
    await db.parentStudent.delete({ where: { parentUserId_studentId: { parentUserId, studentId } } });
    await audit({ action: 'parent.unlink', actorId: me.id, schoolId: me.schoolId, details: { parentUserId, studentId } });
    return done('Волид аз хонанда ҷудо шуд.');
  });
}

/**
 * Мутахассис (ё мудир барои мутахассис) логин ва/ё пароли корбарро иваз мекунад —
 * бе донистани пароли пешина. Парол: дастӣ ё тасодуфӣ. Ҳамаи сессияҳои корбар баста мешаванд.
 */
export async function setUserCredentials(_p: FormState, fd: FormData): Promise<FormState> {
  return run(['/specialist/teachers', '/specialist/students', '/director/staff'], async (me) => {
    const target = await db.user.findUnique({ where: { id: id.parse(f(fd, 'userId')) } });
    if (!target || target.schoolId !== me.schoolId || !canManage(me.role, target.role)) throw new Error('Дастрасӣ манъ аст.');

    const newLogin = normalizeLogin(f(fd, 'login'));
    const loginChanged = newLogin !== '' && newLogin !== target.login;
    if (loginChanged) {
      const err = validateLogin(newLogin);
      if (err) throw new Error(err);
      const asPhone = normalizePhone(newLogin);
      if (asPhone && asPhone !== target.phone) throw new Error('Рақами телефони дигарро ҳамчун логин истифода бурдан мумкин нест.');
      const taken = await db.user.findFirst({ where: { OR: [{ login: newLogin }, { phone: newLogin }], NOT: { id: target.id } }, select: { id: true } });
      if (taken) throw new Error('Ин логин банд аст.');
    }

    const mode = f(fd, 'pwdMode'); // "keep" | "random" | "manual"
    let password: string | null = null;
    if (mode === 'random') password = generatePassword();
    if (mode === 'manual') {
      password = f(fd, 'password');
      const err = validateNewPassword(password);
      if (err) throw new Error(err);
    }
    if (!loginChanged && !password) return done('Тағйир нест.');

    const mustChange = f(fd, 'mustChange') === 'on';
    await db.$transaction([
      db.user.update({
        where: { id: target.id },
        data: {
          ...(loginChanged ? { login: newLogin } : {}),
          ...(password ? { passwordHash: await hashPassword(password), mustChangePassword: mustChange, failedAttempts: 0, lockedUntil: null } : {}),
        },
      }),
      db.session.deleteMany({ where: { userId: target.id } }),
    ]);
    await audit({
      action: 'credentials.set', actorId: me.id, schoolId: me.schoolId, entity: 'User', entityId: target.id,
      details: { role: target.role, login: loginChanged ? { old: target.login, new: newLogin } : null, password: password ? mode : null, mustChange },
    });
    const login = loginChanged ? newLogin : target.login;
    return done(
      `Сабт шуд${loginChanged ? ': логини нав' : ''}${password ? `${loginChanged ? ' ва' : ':'} пароли нав` : ''}.`,
      password ? [{ fullName: target.fullName, login, password }] : loginChanged ? [{ fullName: target.fullName, login, password: '(бетағйир)' }] : undefined,
    );
  });
}
