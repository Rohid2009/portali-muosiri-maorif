import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext, STAFF } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { PrintButton } from '@/components/PrintButton';
import { setExamGrades } from '@/app/actions/specialist';
import { periodTable, fmtGrade } from '@/lib/summary';

export const dynamic = 'force-dynamic';

export default async function GradesPage({ searchParams }: { searchParams: { classId?: string; subjectId?: string } }) {
  const user = await requireSchoolUser(STAFF);
  const ctx = await schoolContext(user.schoolId);
  if (!ctx.year) return <PageShell user={user} title="Чорякӣ"><Section><Empty>Соли таҳсил нест.</Empty></Section></PageShell>;

  const [classes, subjects] = await Promise.all([
    db.class.findMany({ where: { academicYearId: ctx.year.id }, orderBy: [{ gradeLevel: 'asc' }, { letter: 'asc' }] }),
    db.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: 'asc' } }),
  ]);
  const cls = classes.find((c) => c.id === Number(searchParams.classId));
  const subject = subjects.find((s) => s.id === Number(searchParams.subjectId));

  let body: React.ReactNode = <Empty>Синф ва фанро интихоб кунед.</Empty>;
  if (cls && subject) {
    const enr = await db.classEnrollment.findMany({ where: { classId: cls.id }, include: { student: true }, orderBy: { student: { fullName: 'asc' } } });
    const table = await periodTable({
      academicYearId: ctx.year.id, quarters: ctx.quarters, examWeightPercent: ctx.settings.examWeightPercent,
      studentIds: enr.map((e) => e.studentId), subjectIds: [subject.id],
    });
    body = (
      <ActionForm action={setExamGrades} submit="Сабти баҳоҳои имтиҳон" className="flex flex-col gap-3">
        <input type="hidden" name="classId" value={cls.id} />
        <input type="hidden" name="subjectId" value={subject.id} />
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>№</th><th>Хонанда</th><th>Ч1</th><th>Ч2</th><th>Ч3</th><th>Ч4</th><th>Имтиҳон</th><th>Солона</th></tr>
            </thead>
            <tbody>
              {enr.map((e, i) => {
                const r = table.get(`${e.studentId}:${subject.id}`);
                return (
                  <tr key={e.studentId}>
                    <td>{i + 1}</td>
                    <td>{e.student.fullName}</td>
                    {[0, 1, 2, 3].map((q) => <td key={q} className={r?.quarters[q] == null ? 'text-slate-400' : ''}>{fmtGrade(r?.quarters[q])}</td>)}
                    <td>
                      <select name={`exam_${e.studentId}`} defaultValue={r?.exam ?? ''} className="select py-1">
                        <option value="">—</option>
                        {Array.from({ length: 10 }, (_, k) => k + 1).map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                    <td className="font-semibold">{fmtGrade(r?.annual)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          Баҳои чорякӣ = ҷамъи баҳоҳо ÷ шумора (&lt; 0.5 — ба поён, ≥ 0.5 — ба боло). Вазни имтиҳон дар баҳои солона: {ctx.settings.examWeightPercent}% (Танзимот).
        </p>
      </ActionForm>
    );
  }

  return (
    <PageShell
      user={user}
      title={`Баҳоҳои чорякӣ${cls && subject ? ` — ${cls.name}, ${subject.name}` : ''}`}
      actions={cls && subject ? (
        <>
          <a className="btn-ghost" href={`/api/export?type=quarter&classId=${cls.id}&subjectId=${subject.id}`}>⬇ Excel (CSV)</a>
          <PrintButton />
        </>
      ) : undefined}
    >
      <Section>
        <form className="flex flex-wrap items-end gap-3 print:hidden" action="/specialist/grades">
          <label className="label">Синф
            <select name="classId" defaultValue={cls?.id} className="select">{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
          <label className="label">Фан
            <select name="subjectId" defaultValue={subject?.id} className="select">{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </label>
          <button className="btn-small" type="submit">OK</button>
        </form>
        {cls && <p className="mt-3 text-sm"><Link className="text-brand underline" href={`/specialist/grades/class/${cls.id}`}>Ҷамъбасти ҳамаи фанҳои {cls.name} →</Link></p>}
      </Section>
      <Section>{body}</Section>
    </PageShell>
  );
}
