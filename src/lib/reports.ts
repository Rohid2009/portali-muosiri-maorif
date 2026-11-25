import 'server-only';
import { db } from './db';
import { toDbDate } from './dates';

export type ClassReportRow = {
  classId: number; name: string; students: number;
  avgGrade: number | null; grades: number;
  present: number; absent: number; excused: number; attendancePct: number | null;
};

/** Ҳисоботи синфҳо барои як давра (бо groupBy — дархостҳои кам ба база) */
export async function classReport(schoolId: number, academicYearId: number, start: string, end: string): Promise<ClassReportRow[]> {
  const range = { gte: toDbDate(start), lte: toDbDate(end) };
  const [classes, gradeAgg, attAgg] = await Promise.all([
    db.class.findMany({
      where: { schoolId, academicYearId },
      orderBy: [{ gradeLevel: 'asc' }, { letter: 'asc' }],
      include: { _count: { select: { enrollments: { where: { student: { status: 'ACTIVE' } } } } } },
    }),
    db.journalEntry.groupBy({ by: ['classId'], where: { schoolId, lessonDate: range, grade: { not: null } }, _avg: { grade: true }, _count: { grade: true } }),
    db.journalEntry.groupBy({ by: ['classId', 'attendance'], where: { schoolId, lessonDate: range }, _count: { _all: true } }),
  ]);
  return classes.map((c) => {
    const g = gradeAgg.find((x) => x.classId === c.id);
    const cnt = (a: string) => attAgg.find((x) => x.classId === c.id && x.attendance === a)?._count._all ?? 0;
    const present = cnt('PRESENT'), absent = cnt('ABSENT'), excused = cnt('EXCUSED');
    const total = present + absent + excused;
    return {
      classId: c.id, name: c.name, students: c._count.enrollments,
      avgGrade: g?._avg.grade != null ? Math.round(g._avg.grade * 100) / 100 : null,
      grades: g?._count.grade ?? 0,
      present, absent, excused,
      attendancePct: total ? Math.round((present / total) * 1000) / 10 : null,
    };
  });
}
