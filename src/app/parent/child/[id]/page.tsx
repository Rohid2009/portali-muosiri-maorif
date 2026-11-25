import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { schoolContext } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { GradeChip, StatCard, Stats, Segmented, Bar, barColor } from '@/components/ui';
import { periodTable } from '@/lib/summary';
import { attendanceStats } from '@/lib/periods';
import { isoOf, toDbDate } from '@/lib/dates';
import { BEH_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'нояб', 'дек'];

/** Волид — танҳо хониш. Дастрасӣ танҳо ба фарзанди худ (санҷиш дар сервер). */
export default async function ChildPage({ params, searchParams }: { params: { id: string }; searchParams: { q?: string } }) {
  const user = await requireRole(['PARENT']);
  const studentId = Number(params.id) || 0;
  const link = await db.parentStudent.findUnique({
    where: { parentUserId_studentId: { parentUserId: user.id, studentId } },
    include: { student: true, school: true },
  });
  if (!link) notFound();

  const ctx = await schoolContext(link.schoolId);
  const enrollment = ctx.year
    ? await db.classEnrollment.findFirst({ where: { studentId, academicYearId: ctx.year.id }, include: { class: true } })
    : null;
  if (!ctx.year || !enrollment) {
    return (
      <PageShell user={user} title={link.student.fullName}>
        <Section><Empty>Маълумоти соли ҷорӣ ҳанӯз нест.</Empty></Section>
      </PageShell>
    );
  }

  const qNum = [1, 2, 3, 4].includes(Number(searchParams.q)) ? Number(searchParams.q) : (ctx.currentQuarter?.number ?? ctx.quarters.filter((q) => q.end < ctx.today).at(-1)?.number ?? 1);
  const quarter = ctx.quarters.find((q) => q.number === qNum);

  const [entries, subjects] = await Promise.all([
    quarter
      ? db.journalEntry.findMany({
          where: { studentId, lessonDate: { gte: toDbDate(quarter.start), lte: toDbDate(quarter.end) } },
          include: { subject: true },
          orderBy: [{ lessonDate: 'desc' }, { lessonNo: 'desc' }],
        })
      : [],
    db.teachingAssignment.findMany({ where: { classId: enrollment.classId }, include: { subject: true }, distinct: ['subjectId'] }),
  ]);
  const subjList = subjects.map((s) => s.subject).sort((a, b) => a.name.localeCompare(b.name));
  const periods = await periodTable({
    academicYearId: ctx.year.id, quarters: ctx.quarters, examWeightPercent: ctx.settings.examWeightPercent,
    studentIds: [studentId], subjectIds: subjList.map((s) => s.id),
  });
  const att = attendanceStats(entries.map((e) => e.attendance));
  const beh = { EXEMPLARY: 0, SATISFACTORY: 0, UNSATISFACTORY: 0 } as Record<string, number>;
  for (const e of entries) if (e.behavior) beh[e.behavior]++;
  const qGrades = subjList.map((s) => periods.get(`${studentId}:${s.id}`)?.quarters[qNum - 1]).filter((v): v is number => typeof v === 'number');
  const allGrades = entries.filter((e) => e.grade !== null).map((e) => e.grade as number);
  const avgShown = qGrades.length
    ? (qGrades.reduce((a, b) => a + b, 0) / qGrades.length).toFixed(1)
    : allGrades.length ? (allGrades.reduce((a, b) => a + b, 0) / allGrades.length).toFixed(1) : '—';

  return (
    <PageShell user={user} title={link.student.fullName} subtitle={`${link.school.name} · синфи ${enrollment.class.name} · ${ctx.year.name}`}>
      <Segmented items={[1, 2, 3, 4].map((n) => ({ href: `?q=${n}`, label: `Чоряки ${n}`, active: n === qNum }))} />

      <Stats>
        <StatCard icon="chart" value={avgShown} label="Баҳои миёна" />
        <StatCard icon="check" tone="green" value={att.percent !== null ? `${att.percent}%` : '—'} label="Давомот" />
        <StatCard icon="x" tone="red" value={att.absent} label={`Нест · ${att.excused} сабабнок`} />
        <StatCard icon="star" tone="gold" value={beh.EXEMPLARY} label="Рафтори намунавӣ" />
      </Stats>
      {beh.UNSATISFACTORY > 0 && (
        <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Рафтори ғайриқаноатбахш: {beh.UNSATISFACTORY} бор дар ин чоряк.</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Section title="Баҳоҳо аз рӯи фанҳо" icon="book">
          {subjList.length === 0 ? <Empty>Фан нест.</Empty> : (
            <div className="divide-y divide-slate-100">
              {subjList.map((s) => {
                const r = periods.get(`${studentId}:${s.id}`);
                const qv = r?.quarters[qNum - 1] ?? null;
                const gs = entries.filter((e) => e.subjectId === s.id && e.grade !== null).reverse();
                return (
                  <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_auto]">
                    <div>
                      <b>{s.name}</b>
                      <div className="mt-2"><Bar percent={(qv ?? 0) * 10} className={barColor(qv)} /></div>
                    </div>
                    <div className="order-3 col-span-2 flex flex-wrap gap-1 sm:order-none sm:col-span-1">
                      {gs.length ? gs.map((g) => <GradeChip key={g.id} value={g.grade} />) : <span className="text-[13px] text-slate-400">ҳанӯз баҳо нест</span>}
                    </div>
                    <div className="text-right text-[13px] text-slate-500">
                      {qNum > 1 && <span>Ч{qNum - 1} {r?.quarters[qNum - 2] ?? '—'} · </span>}
                      <GradeChip value={qv} strong />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[13px] text-slate-500">Баҳои чорякӣ = миёнаи баҳоҳо (≥ 0.5 ба боло). Танҳо хониш.</p>
        </Section>

        <Section title="Рӯзнома" icon="cal">
          {entries.length === 0 ? <Empty>Дар ин чоряк сабт нест.</Empty> : (
            <ul className="divide-y divide-slate-100">
              {entries.slice(0, 60).map((e) => {
                const iso = isoOf(e.lessonDate);
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-12 shrink-0 text-center text-xs leading-tight text-slate-500">
                      <b className="block text-lg text-ink">{Number(iso.slice(8))}</b>{MONTHS[Number(iso.slice(5, 7)) - 1]}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      {e.subject.name}
                      {e.behavior && <span className={`pill ml-1.5 ${e.behavior === 'UNSATISFACTORY' ? 'pill-red' : 'pill-blue'}`}>{BEH_LABEL[e.behavior]}</span>}
                    </span>
                    {e.grade !== null && <GradeChip value={e.grade} />}
                    {e.attendance === 'ABSENT' && <span className="pill pill-red">Нест</span>}
                    {e.attendance === 'EXCUSED' && <span className="pill pill-amber">Сабабнок</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </PageShell>
  );
}
