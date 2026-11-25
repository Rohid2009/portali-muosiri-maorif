import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { PrintButton } from '@/components/PrintButton';
import { StatCard, Stats, Segmented, Avatar, barColor } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { classReport } from '@/lib/reports';
import { formatTj, toDbDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function DirectorHome({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireSchoolUser(['DIRECTOR']);
  const ctx = await schoolContext(user.schoolId);
  const school = await db.school.findUnique({ where: { id: user.schoolId } });
  if (!ctx.year || ctx.quarters.length === 0) {
    return <PageShell user={user} title="Ҳисобот"><Section><Empty>Соли таҳсил ва чорякҳо ҳанӯз муқаррар нашудаанд.</Empty></Section></PageShell>;
  }
  const qNum = [1, 2, 3, 4].includes(Number(searchParams.q)) ? Number(searchParams.q) : (ctx.currentQuarter?.number ?? 1);
  const q = ctx.quarters.find((x) => x.number === qNum) ?? ctx.quarters[0];
  const rows = await classReport(user.schoolId, ctx.year.id, q.start, q.end);

  const range = { gte: toDbDate(q.start), lte: toDbDate(q.end) };
  const [absentees, pending, teachersNoEntries] = await Promise.all([
    db.journalEntry.groupBy({
      by: ['studentId'], where: { schoolId: user.schoolId, attendance: 'ABSENT', lessonDate: range },
      _count: { _all: true }, orderBy: { _count: { studentId: 'desc' } }, take: 10,
    }),
    db.gradeCorrection.count({ where: { schoolId: user.schoolId, status: 'PENDING' } }),
    db.user.findMany({
      where: { schoolId: user.schoolId, role: 'TEACHER', isActive: true, teachingAssignments: { some: { activeTo: null } }, enteredEntries: { none: { lessonDate: range } } },
      select: { fullName: true },
    }),
  ]);
  const names = new Map(
    (await db.student.findMany({ where: { id: { in: absentees.map((a) => a.studentId) } }, select: { id: true, fullName: true } })).map((s) => [s.id, s.fullName]),
  );
  const tot = rows.reduce((a, r) => ({ students: a.students + r.students, present: a.present + r.present, absent: a.absent + r.absent, excused: a.excused + r.excused }), { students: 0, present: 0, absent: 0, excused: 0 });
  const allAtt = tot.present + tot.absent + tot.excused;
  const graded = rows.filter((r) => r.avgGrade !== null);
  const schoolAvg = graded.length ? graded.reduce((a, r) => a + (r.avgGrade ?? 0) * r.grades, 0) / graded.reduce((a, r) => a + r.grades, 0) : null;

  return (
    <PageShell
      user={user}
      title={`Ҳисоботи чоряки ${q.number}`}
      subtitle={`${school?.name ?? ''} · ${formatTj(q.start)} – ${formatTj(q.end)}${q.closed ? ' · баста' : ''}`}
      actions={<><a className="btn-ghost" href={`/api/export?type=report&q=${q.number}`}><Icon name="down" className="h-4 w-4" />Excel</a><PrintButton /></>}
    >
      <Segmented items={ctx.quarters.map((x) => ({ href: `?q=${x.number}`, label: `Чоряки ${x.number}`, active: x.number === q.number }))} />

      <Stats>
        <StatCard icon="family" value={tot.students} label="Хонандагон" />
        <StatCard icon="chart" tone="green" value={schoolAvg !== null ? schoolAvg.toFixed(2) : '—'} label="Баҳои миёна" />
        <StatCard icon="check" value={allAtt ? `${((tot.present / allAtt) * 100).toFixed(1)}%` : '—'} label="Давомот" />
        <StatCard icon="inbox" tone="gold" value={pending} label="Дархостҳо" href="/specialist/corrections" alert={pending > 0} />
      </Stats>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Section title="Баҳои миёна ва давомот аз рӯи синфҳо" icon="chart">
          {rows.length === 0 ? <Empty>Синф нест.</Empty> : (
            <div>
              {rows.map((r) => (
                <div key={r.classId} className="grid grid-cols-[52px_minmax(0,1fr)_58px] items-center gap-2.5 py-1.5 text-sm">
                  <Link className="font-semibold text-brand hover:underline" href={`/specialist/grades/class/${r.classId}?p=${q.number}`}>{r.name}</Link>
                  <div>
                    <div className="relative h-[22px] overflow-hidden rounded-[7px] bg-slate-100">
                      <div className={`absolute inset-y-0 left-0 rounded-[7px] ${barColor(r.avgGrade !== null ? Math.round(r.avgGrade) : null)}`} style={{ width: `${(r.avgGrade ?? 0) * 10}%` }} />
                    </div>
                    <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${r.attendancePct !== null && r.attendancePct < 90 ? 'bg-red-600' : 'bg-brand'}`} style={{ width: `${r.attendancePct ?? 0}%` }} />
                    </div>
                  </div>
                  <div className="text-right font-bold tabular-nums leading-tight">
                    {r.avgGrade ?? '—'}
                    <span className={`block text-xs font-medium ${r.attendancePct !== null && r.attendancePct < 90 ? 'text-red-600' : 'text-slate-500'}`}>{r.attendancePct ?? '—'}{r.attendancePct !== null && '%'}</span>
                  </div>
                </div>
              ))}
              <p className="mt-3 text-[13px] text-slate-500">Хати ғафс — баҳои миёна (аз 10), хати борик — давомот (сурх — зери 90%). Ба синф пахш кунед — ҷамъбасти пурра.</p>
            </div>
          )}
        </Section>

        <div>
          <Section title="Бештар ғоиб (бесабаб)" icon="alert">
            {absentees.length === 0 ? <Empty>Нест.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {absentees.map((a) => (
                  <li key={a.studentId} className="flex items-center gap-3 py-2.5 text-sm">
                    <Avatar name={names.get(a.studentId) ?? '?'} />
                    <span className="flex-1">{names.get(a.studentId)}</span>
                    <span className="pill pill-red">{a._count._all} дарс</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Журнал пур нашудааст" icon="users">
            {teachersNoEntries.length === 0 ? <Empty>Ҳама омӯзгорон сабт кардаанд.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {teachersNoEntries.map((t) => (
                  <li key={t.fullName} className="flex items-center gap-3 py-2.5 text-sm"><Avatar name={t.fullName} />{t.fullName}</li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </PageShell>
  );
}
