'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { actor, schoolContext } from '@/lib/context';
import { audit } from '@/lib/audit';
import { isIsoDate, toDbDate, todayISO } from '@/lib/dates';
import { loadAssignment, todaysLessonNumbers } from '@/lib/teaching';
import type { Prisma } from '@prisma/client';
import { done, fail, errorMessage, type FormState } from '@/lib/form';

const id = z.coerce.number().int().positive();
const ATT = z.enum(['PRESENT', 'ABSENT', 'EXCUSED']);
const BEH = z.enum(['EXEMPLARY', 'SATISFACTORY', 'UNSATISFACTORY']);

function f(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
}

/**
 * Сабти журнали имрӯза. Сана — танҳо имрӯз (сервер муайян мекунад).
 * Сабти мавҷударо иваз кардан мумкин нест; танҳо ҷойҳои холӣ (баҳо/рафтор) пур мешаванд.
 */
export async function saveJournal(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await actor(['TEACHER']);
    const a = await loadAssignment(id.parse(f(fd, 'assignmentId')), me.id, me.schoolId);
    const ctx = await schoolContext(me.schoolId);
    if (!ctx.currentQuarter) throw new Error('Имрӯз ба ягон чоряк дохил намешавад (таътил ё санаҳо муқаррар нашудаанд).');
    if (ctx.currentQuarter.closed) throw new Error('Чоряк баста шудааст.');

    const lessonNo = z.coerce.number().int().min(1).max(12).parse(f(fd, 'lessonNo'));
    const sched = await todaysLessonNumbers(a.classId, a.subjectId, me.id);
    if (sched.hasSchedule && !sched.numbers.includes(lessonNo)) {
      throw new Error('Мувофиқи ҷадвал имрӯз шумо дар ин синф ин дарсро надоред.');
    }

    const today = toDbDate(ctx.today);
    const enrollments = await db.classEnrollment.findMany({
      where: { classId: a.classId, student: { status: 'ACTIVE' } },
      select: { studentId: true },
    });
    const existing = await db.journalEntry.findMany({
      where: { classId: a.classId, subjectId: a.subjectId, lessonDate: today, lessonNo },
    });
    const byStudent = new Map(existing.map((e) => [e.studentId, e]));

    let created = 0, filled = 0, skipped = 0;
    const log: { s: number; g: number | null; a: string; b: string | null }[] = [];
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const { studentId } of enrollments) {
      const attRaw = f(fd, `att_${studentId}`);
      const gradeRaw = f(fd, `grade_${studentId}`);
      const behRaw = f(fd, `beh_${studentId}`);
      if (!attRaw && !gradeRaw && !behRaw) continue;
      const attendance = ATT.parse(attRaw || 'PRESENT');
      const grade = gradeRaw ? z.coerce.number().int().min(1).max(10).parse(gradeRaw) : null;
      const behavior = behRaw ? BEH.parse(behRaw) : null;
      if (grade !== null && attendance !== 'PRESENT') throw new Error('Ба хонандаи ғоиб баҳо гузошта намешавад.');

      const cur = byStudent.get(studentId);
      if (!cur) {
        ops.push(db.journalEntry.create({
          data: { schoolId: me.schoolId, studentId, classId: a.classId, subjectId: a.subjectId, enteredById: me.id, lessonDate: today, lessonNo, grade, attendance, behavior },
        }));
        created++;
        log.push({ s: studentId, g: grade, a: attendance, b: behavior });
        continue;
      }
      // Танҳо пур кардани ҷойи холӣ; ҳар тағйири дигар — тавассути дархости тасҳеҳ
      const data: { grade?: number; behavior?: 'EXEMPLARY' | 'SATISFACTORY' | 'UNSATISFACTORY' } = {};
      if (grade !== null && cur.grade === null && cur.attendance === 'PRESENT' && attendance === 'PRESENT') data.grade = grade;
      if (behavior && !cur.behavior) data.behavior = behavior;
      const conflicting =
        attendance !== cur.attendance ||
        (grade !== null && cur.grade !== null && grade !== cur.grade) ||
        (behavior && cur.behavior && behavior !== cur.behavior);
      if (conflicting) skipped++;
      if (Object.keys(data).length) {
        ops.push(db.journalEntry.update({ where: { id: cur.id }, data }));
        filled++;
        log.push({ s: studentId, g: data.grade ?? null, a: cur.attendance, b: data.behavior ?? null });
      }
    }
    if (ops.length) await db.$transaction(ops);
    await audit({
      action: 'journal.save', actorId: me.id, schoolId: me.schoolId,
      details: { classId: a.classId, subjectId: a.subjectId, date: ctx.today, lessonNo, created, filled, entries: log },
    });
    revalidatePath('/teacher/journal');
    const msg = `Сабт шуд: ${created} нав, ${filled} пур карда шуд.`;
    return done(skipped ? `${msg} ${skipped} тағйир қабул нашуд — барои иваз «дархости тасҳеҳ» фиристед.` : msg);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Дархости тасҳеҳ: иваз кардани сабти мавҷуда ё иловаи сабт барои рӯзи гузашта */
export async function requestCorrection(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await actor(['TEACHER']);
    const a = await loadAssignment(id.parse(f(fd, 'assignmentId')), me.id, me.schoolId);
    const reason = z.string().trim().min(5, 'Сабабро муфассал нависед (камаш 5 аломат).').max(500).parse(f(fd, 'reason'));
    const attendance = ATT.parse(f(fd, 'attendance'));
    const grade = f(fd, 'grade') ? z.coerce.number().int().min(1).max(10).parse(f(fd, 'grade')) : null;
    const behavior = f(fd, 'behavior') ? BEH.parse(f(fd, 'behavior')) : null;
    if (grade !== null && attendance !== 'PRESENT') throw new Error('Ба хонандаи ғоиб баҳо гузошта намешавад.');
    const newValue = { grade, attendance, behavior };

    let entry: Awaited<ReturnType<typeof db.journalEntry.findUnique>> = null;
    let studentId: number, lessonDate: Date, lessonNo: number;
    if (f(fd, 'entryId')) {
      entry = await db.journalEntry.findUnique({ where: { id: id.parse(f(fd, 'entryId')) } });
      if (!entry || entry.classId !== a.classId || entry.subjectId !== a.subjectId) throw new Error('Сабт ёфт нашуд.');
      studentId = entry.studentId; lessonDate = entry.lessonDate; lessonNo = entry.lessonNo;
    } else {
      studentId = id.parse(f(fd, 'studentId'));
      const d = z.string().refine(isIsoDate, 'Санаи нодуруст').parse(f(fd, 'lessonDate'));
      if (d > todayISO()) throw new Error('Санаи оянда мумкин нест.');
      lessonDate = toDbDate(d);
      lessonNo = z.coerce.number().int().min(1).max(12).parse(f(fd, 'lessonNo') || '1');
      const enr = await db.classEnrollment.findFirst({ where: { classId: a.classId, studentId } });
      if (!enr) throw new Error('Хонанда дар ин синф нест.');
    }
    const pending = await db.gradeCorrection.findFirst({
      where: { studentId, subjectId: a.subjectId, lessonDate, lessonNo, status: 'PENDING' },
    });
    if (pending) throw new Error('Барои ин сабт аллакай дархости баррасинашуда ҳаст.');

    const c = await db.gradeCorrection.create({
      data: {
        schoolId: me.schoolId, journalEntryId: entry?.id ?? null, studentId, classId: a.classId, subjectId: a.subjectId,
        lessonDate, lessonNo, requestedById: me.id, reason, newValue,
        oldValue: entry ? { grade: entry.grade, attendance: entry.attendance, behavior: entry.behavior } : undefined,
      },
    });
    await audit({ action: 'correction.request', actorId: me.id, schoolId: me.schoolId, entity: 'GradeCorrection', entityId: c.id, details: { newValue, reason } });
    revalidatePath('/teacher/corrections');
    return done('Дархост фиристода шуд. Мутахассис ё мудир онро баррасӣ мекунад.');
  } catch (e) {
    return fail(errorMessage(e));
  }
}
