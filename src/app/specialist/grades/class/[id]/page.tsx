import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext, STAFF } from '@/lib/context';
import { PageShell, Section } from '@/components/PageShell';
import { PrintButton } from '@/components/PrintButton';
import { periodTable } from '@/lib/summary';

export const dynamic = 'force-dynamic';

const PERIODS = [
  { key: '1', label: 'Чоряки 1' }, { key: '2', label: 'Чоряки 2' },
  { key: '3', label: 'Чоряки 3' }, { key: '4', label: 'Чоряки 4' },
  { key: 'annual', label: 'Солона' },
];

/** Ҷамъбасти синф: хонандагон × фанҳо барои як давра */
export default async function ClassSummaryPage({ params, searchParams }: { params: { id: string }; searchParams: { p?: string } }) {
  const user = await requireSchoolUser(STAFF);
  const ctx = await schoolContext(user.schoolId);
  const cls = await db.class.findUnique({ where: { id: Number(params.id) || 0 } });
  if (!cls || cls.schoolId !== user.schoolId) notFound();
  const year = await db.academicYear.findUniqueOrThrow({ where: { id: cls.academicYearId }, include: { quarters: true } });
  const quarters = year.isCurrent ? ctx.quarters : year.quarters.map((q) => ({ id: q.id, number: q.number, start: q.startDate.toISOString().slice(0, 10), end: q.endDate.toISOString().slice(0, 10), closed: q.isClosed }));
  const p = PERIODS.find((x) => x.key === searchParams.p) ?? PERIODS[ctx.currentQuarter ? ctx.currentQuarter.number - 1 : 0];

  const [enr, assignments] = await Promise.all([
    db.classEnrollment.findMany({ where: { classId: cls.id }, include: { student: true }, orderBy: { student: { fullName: 'asc' } } }),
    db.teachingAssignment.findMany({ where: { classId: cls.id }, include: { subject: true }, distinct: ['subjectId'] }),
  ]);
  const subjects = assignments.map((a) => a.subject).sort((a, b) => a.name.localeCompare(b.name));
  const table = await periodTable({
    academicYearId: cls.academicYearId, quarters, examWeightPercent: ctx.settings.examWeightPercent,
    studentIds: enr.map((e) => e.studentId), subjectIds: subjects.map((s) => s.id),
  });
  const val = (sid: number, subj: number) => {
    const r = table.get(`${sid}:${subj}`);
    if (!r) return null;
    return p.key === 'annual' ? r.annual : r.quarters[Number(p.key) - 1];
  };

  return (
    <PageShell
      user={user}
      title={`${cls.name} — ${p.label} (${year.name})`}
      actions={<><a className="btn-ghost" href={`/api/export?type=class&classId=${cls.id}&p=${p.key}`}>⬇ Excel (CSV)</a><PrintButton /></>}
    >
      <Section>
        <div className="mb-4 flex flex-wrap gap-2 print:hidden">
          {PERIODS.map((x) => (
            <Link key={x.key} href={`?p=${x.key}`} className={x.key === p.key ? 'btn-small' : 'btn-ghost'}>{x.label}</Link>
          ))}
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>№</th><th>Хонанда</th>
                {subjects.map((s) => <th key={s.id} className="whitespace-nowrap">{s.shortName ?? s.name}</th>)}
                <th>Миёна</th>
              </tr>
            </thead>
            <tbody>
              {enr.map((e, i) => {
                const vals = subjects.map((s) => val(e.studentId, s.id));
                const nums = vals.filter((v): v is number => v !== null);
                const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '—';
                return (
                  <tr key={e.studentId}>
                    <td>{i + 1}</td>
                    <td className="whitespace-nowrap">{e.student.fullName}</td>
                    {vals.map((v, k) => <td key={k} className={v === null ? 'text-slate-400' : v <= 4 ? 'font-semibold text-red-600' : ''}>{v ?? '—'}</td>)}
                    <td className="font-semibold">{avg}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">«—» = бе баҳо. Сурх — баҳои 4 ва камтар.</p>
      </Section>
    </PageShell>
  );
}
