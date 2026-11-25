import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { schoolContext } from '@/lib/context';
import { loadAssignment } from '@/lib/teaching';
import { periodTable } from '@/lib/summary';
import { classReport } from '@/lib/reports';
import { csvResponse } from '@/lib/csv';
import { audit } from '@/lib/audit';
import { formatTj, isoOf } from '@/lib/dates';
import { ATT_LABEL, BEH_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

const deny = () => new Response('Дастрасӣ манъ аст', { status: 403 });
const STAFF = ['SPECIALIST', 'DIRECTOR'];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || user.schoolId === null) return deny();
  const schoolId = user.schoolId;
  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const num = (k: string) => Number(url.searchParams.get(k)) || 0;
  const ctx = await schoolContext(schoolId);
  const yearId = ctx.year?.id ?? 0;

  await audit({ action: 'export', actorId: user.id, schoolId, details: Object.fromEntries(url.searchParams) });

  // ── Журнали омӯзгор (танҳо синф/фани худ) ──
  if (type === 'journal') {
    if (user.role !== 'TEACHER') return deny();
    const a = await loadAssignment(num('a'), user.id, schoolId).catch(() => null);
    if (!a) return deny();
    const entries = await db.journalEntry.findMany({
      where: { classId: a.classId, subjectId: a.subjectId },
      include: { student: true },
      orderBy: [{ lessonDate: 'asc' }, { lessonNo: 'asc' }, { student: { fullName: 'asc' } }],
    });
    return csvResponse(`Журнал_${a.class.name}_${a.subject.name}`, [
      ['Сана', 'Дарс', 'Хонанда', 'Баҳо', 'Давомот', 'Одобу рафтор'],
      ...entries.map((e) => [formatTj(isoOf(e.lessonDate)), e.lessonNo, e.student.fullName, e.grade, ATT_LABEL[e.attendance], e.behavior ? BEH_LABEL[e.behavior] : '']),
    ]);
  }

  if (!STAFF.includes(user.role)) return deny();

  // ── Чорякии як фан ──
  if (type === 'quarter') {
    const cls = await db.class.findUnique({ where: { id: num('classId') } });
    const subject = await db.subject.findUnique({ where: { id: num('subjectId') } });
    if (!cls || !subject || cls.schoolId !== schoolId || subject.schoolId !== schoolId) return deny();
    const enr = await db.classEnrollment.findMany({ where: { classId: cls.id }, include: { student: true }, orderBy: { student: { fullName: 'asc' } } });
    const t = await periodTable({ academicYearId: cls.academicYearId, quarters: ctx.quarters, examWeightPercent: ctx.settings.examWeightPercent, studentIds: enr.map((e) => e.studentId), subjectIds: [subject.id] });
    return csvResponse(`Чорякӣ_${cls.name}_${subject.name}`, [
      ['№', 'Хонанда', 'Ч1', 'Ч2', 'Ч3', 'Ч4', 'Имтиҳон', 'Солона'],
      ...enr.map((e, i) => {
        const r = t.get(`${e.studentId}:${subject.id}`);
        return [i + 1, e.student.fullName, ...(r?.quarters ?? [null, null, null, null]).map((v) => v ?? 'бе баҳо'), r?.exam ?? '', r?.annual ?? 'бе баҳо'];
      }),
    ]);
  }

  // ── Ҷамъбасти синф (ҳамаи фанҳо) ──
  if (type === 'class') {
    const cls = await db.class.findUnique({ where: { id: num('classId') } });
    if (!cls || cls.schoolId !== schoolId) return deny();
    const p = url.searchParams.get('p') ?? '1';
    const enr = await db.classEnrollment.findMany({ where: { classId: cls.id }, include: { student: true }, orderBy: { student: { fullName: 'asc' } } });
    const subjects = (await db.teachingAssignment.findMany({ where: { classId: cls.id }, include: { subject: true }, distinct: ['subjectId'] })).map((a) => a.subject);
    const t = await periodTable({ academicYearId: cls.academicYearId, quarters: ctx.quarters, examWeightPercent: ctx.settings.examWeightPercent, studentIds: enr.map((e) => e.studentId), subjectIds: subjects.map((s) => s.id) });
    return csvResponse(`${cls.name}_${p === 'annual' ? 'солона' : `чоряки_${p}`}`, [
      ['№', 'Хонанда', ...subjects.map((s) => s.name)],
      ...enr.map((e, i) => [i + 1, e.student.fullName, ...subjects.map((s) => {
        const r = t.get(`${e.studentId}:${s.id}`);
        const v = p === 'annual' ? r?.annual : r?.quarters[Number(p) - 1];
        return v ?? 'бе баҳо';
      })]),
    ]);
  }

  // ── Ҳисоботи мудир ──
  if (type === 'report') {
    const q = ctx.quarters.find((x) => x.number === num('q'));
    if (!q || !ctx.year) return new Response('Чоряк ёфт нашуд', { status: 404 });
    const rows = await classReport(schoolId, ctx.year.id, q.start, q.end);
    return csvResponse(`Ҳисобот_чоряки_${q.number}`, [
      ['Синф', 'Хонандагон', 'Баҳои миёна', 'Шумораи баҳо', 'Давомот %', 'Ҳаст', 'Нест', 'Сабабнок'],
      ...rows.map((r) => [r.name, r.students, r.avgGrade, r.grades, r.attendancePct, r.present, r.absent, r.excused]),
    ]);
  }

  // ── Содироти ҳамаи маълумот ──
  if (type === 'all') {
    const table = url.searchParams.get('table');
    switch (table) {
      case 'students': {
        const rows = await db.classEnrollment.findMany({
          where: { schoolId }, include: { student: { include: { parents: { include: { parent: true } } } }, class: true, academicYear: true },
          orderBy: [{ academicYear: { startDate: 'desc' } }, { class: { gradeLevel: 'asc' } }, { student: { fullName: 'asc' } }],
        });
        return csvResponse('Хонандагон', [
          ['Сол', 'Синф', 'Хонанда', 'Ҷинс', 'Ҳолат', 'Натиҷаи сол', 'Волидон (логин)'],
          ...rows.map((r) => [r.academicYear.name, r.class.name, r.student.fullName, r.student.gender, r.student.status, r.yearResult, r.student.parents.map((p) => `${p.parent.fullName} (${p.parent.login})`).join(', ')]),
        ]);
      }
      case 'teachers': {
        const rows = await db.teachingAssignment.findMany({ where: { schoolId }, include: { teacher: true, class: true, subject: true, academicYear: true }, orderBy: { teacher: { fullName: 'asc' } } });
        return csvResponse('Омӯзгорон', [
          ['Омӯзгор', 'Логин', 'Сол', 'Синф', 'Фан', 'Аз', 'То'],
          ...rows.map((r) => [r.teacher.fullName, r.teacher.login, r.academicYear.name, r.class.name, r.subject.name, formatTj(isoOf(r.activeFrom)), r.activeTo ? formatTj(isoOf(r.activeTo)) : '']),
        ]);
      }
      case 'journal': {
        const rows = await db.journalEntry.findMany({
          where: { schoolId, class: { academicYearId: yearId } },
          include: { student: true, class: true, subject: true, enteredBy: true },
          orderBy: [{ lessonDate: 'asc' }, { classId: 'asc' }],
        });
        return csvResponse('Журнал', [
          ['Сана', 'Дарс', 'Синф', 'Фан', 'Хонанда', 'Баҳо', 'Давомот', 'Рафтор', 'Омӯзгор'],
          ...rows.map((e) => [formatTj(isoOf(e.lessonDate)), e.lessonNo, e.class.name, e.subject.name, e.student.fullName, e.grade, ATT_LABEL[e.attendance], e.behavior ? BEH_LABEL[e.behavior] : '', e.enteredBy.fullName]),
        ]);
      }
      case 'periods': {
        const rows = await db.periodGrade.findMany({ where: { schoolId }, include: { student: true, subject: true, academicYear: true }, orderBy: [{ academicYearId: 'asc' }, { student: { fullName: 'asc' } }] });
        return csvResponse('Баҳоҳои_давра', [
          ['Сол', 'Хонанда', 'Фан', 'Давра', 'Баҳо'],
          ...rows.map((r) => [r.academicYear.name, r.student.fullName, r.subject.name, r.kind, r.value ?? 'бе баҳо']),
        ]);
      }
      case 'schedule': {
        const rows = await db.scheduleLesson.findMany({ where: { schoolId }, include: { class: true, subject: true, teacher: true }, orderBy: [{ classId: 'asc' }, { weekday: 'asc' }, { lessonNo: 'asc' }] });
        return csvResponse('Ҷадвал', [
          ['Синф', 'Рӯз', 'Дарс', 'Вақт', 'Фан', 'Омӯзгор'],
          ...rows.map((r) => [r.class.name, r.weekday, r.lessonNo, `${r.startTime}-${r.endTime}`, r.subject.name, r.teacher.fullName]),
        ]);
      }
      case 'corrections': {
        const rows = await db.gradeCorrection.findMany({ where: { schoolId }, include: { requestedBy: true, reviewedBy: true }, orderBy: { createdAt: 'desc' } });
        return csvResponse('Дархостҳо', [
          ['Сана', 'Хонанда ID', 'Фан ID', 'Кӯҳна', 'Нав', 'Сабаб', 'Ҳолат', 'Омӯзгор', 'Баррасӣ'],
          ...rows.map((r) => [formatTj(isoOf(r.lessonDate)), r.studentId, r.subjectId, JSON.stringify(r.oldValue), JSON.stringify(r.newValue), r.reason, r.status, r.requestedBy.fullName, r.reviewedBy?.fullName]),
        ]);
      }
      case 'audit': {
        if (user.role !== 'DIRECTOR') return deny();
        const rows = await db.auditLog.findMany({ where: { schoolId }, include: { actor: true }, orderBy: { createdAt: 'desc' }, take: 20000 });
        return csvResponse('Сабти_тағйирот', [
          ['Вақт', 'Кӣ', 'Амал', 'Объект', 'Тафсилот', 'IP'],
          ...rows.map((r) => [r.createdAt.toISOString(), r.actor?.fullName, r.action, r.entity ? `${r.entity}#${r.entityId}` : '', r.details ? JSON.stringify(r.details) : '', r.ip]),
        ]);
      }
    }
  }
  return new Response('Навъи содирот нодуруст', { status: 400 });
}
