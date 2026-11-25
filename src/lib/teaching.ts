import 'server-only';
import { db } from './db';
import { toDbDate, todayISO, weekdayOf } from './dates';

/**
 * Тақсимоти омӯзгор — санҷиши сервер: тақсимот аз они ӯ, фаъол ва соли ҷорӣ.
 * Ин функсия дар саҳифаҳо ҳам истифода мешавад.
 */
export async function loadAssignment(assignmentId: number, teacherId: number, schoolId: number) {
  const today = toDbDate(todayISO());
  const a = await db.teachingAssignment.findFirst({
    where: {
      id: assignmentId, teacherId, schoolId,
      activeFrom: { lte: today },
      OR: [{ activeTo: null }, { activeTo: { gte: today } }],
      academicYear: { isCurrent: true },
    },
    include: { class: true, subject: true },
  });
  if (!a) throw new Error('Ин синф/фан ба шумо тақсим нашудааст.');
  return a;
}

/** Рақамҳои дарсе, ки имрӯз мувофиқи ҷадвал ин омӯзгор дар ин синф/фан дорад */
export async function todaysLessonNumbers(classId: number, subjectId: number, teacherId: number): Promise<{ numbers: number[]; hasSchedule: boolean }> {
  const weekday = weekdayOf(todayISO());
  const [lessons, any] = await Promise.all([
    db.scheduleLesson.findMany({ where: { classId, subjectId, teacherId, weekday }, orderBy: { lessonNo: 'asc' } }),
    db.scheduleLesson.count({ where: { classId } }),
  ]);
  return { numbers: lessons.map((l) => l.lessonNo), hasSchedule: any > 0 };
}

