import { db } from '@/lib/db';
import { requireSchoolUser, STAFF } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { reviewCorrection } from '@/app/actions/specialist';
import { formatTj, isoOf } from '@/lib/dates';
import { describeValue } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function CorrectionsPage() {
  const user = await requireSchoolUser(STAFF);
  const [pending, recent] = await Promise.all([
    db.gradeCorrection.findMany({ where: { schoolId: user.schoolId, status: 'PENDING' }, include: { requestedBy: true }, orderBy: { createdAt: 'asc' } }),
    db.gradeCorrection.findMany({ where: { schoolId: user.schoolId, NOT: { status: 'PENDING' } }, include: { requestedBy: true, reviewedBy: true }, orderBy: { reviewedAt: 'desc' }, take: 30 }),
  ]);
  const ids = [...pending, ...recent];
  const [students, subjects, classes] = await Promise.all([
    db.student.findMany({ where: { id: { in: ids.map((c) => c.studentId) } }, select: { id: true, fullName: true } }),
    db.subject.findMany({ where: { id: { in: ids.map((c) => c.subjectId) } }, select: { id: true, name: true } }),
    db.class.findMany({ where: { id: { in: ids.map((c) => c.classId) } }, select: { id: true, name: true } }),
  ]);
  const st = new Map(students.map((s) => [s.id, s.fullName]));
  const sb = new Map(subjects.map((s) => [s.id, s.name]));
  const cl = new Map(classes.map((s) => [s.id, s.name]));

  return (
    <PageShell user={user} title="Дархостҳои тасҳеҳ">
      <Section title={`Интизори баррасӣ (${pending.length})`}>
        {pending.length === 0 ? <Empty>Дархост нест.</Empty> : (
          <div className="space-y-3">
            {pending.map((c) => (
              <div key={c.id} className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p><b>{st.get(c.studentId)}</b> · {cl.get(c.classId)} · {sb.get(c.subjectId)} · {formatTj(isoOf(c.lessonDate))}, дарси {c.lessonNo}</p>
                <p className="text-sm">
                  {c.journalEntryId ? <>Аз: <b>{describeValue(c.oldValue)}</b> → ба: </> : <>Сабти нав (рӯзи гузашта): </>}
                  <b>{describeValue(c.newValue)}</b>
                </p>
                <p className="text-sm text-slate-700">Сабаб: {c.reason}</p>
                <p className="text-xs text-slate-500">Омӯзгор: {c.requestedBy.fullName}</p>
                <div className="mt-2 flex gap-2">
                  <ActionForm action={reviewCorrection} submit="✔ Тасдиқ" variant="small">
                    <input type="hidden" name="correctionId" value={c.id} />
                    <input type="hidden" name="decision" value="approve" />
                  </ActionForm>
                  <ActionForm action={reviewCorrection} submit="✕ Рад" variant="danger">
                    <input type="hidden" name="correctionId" value={c.id} />
                    <input type="hidden" name="decision" value="reject" />
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Баррасишудаҳо (30 охирин)">
        {recent.length === 0 ? <Empty>Нест.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Хонанда</th><th>Фан</th><th>Сана</th><th>Нав</th><th>Ҳолат</th><th>Кӣ</th></tr></thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id}>
                    <td>{st.get(c.studentId)}</td>
                    <td>{sb.get(c.subjectId)}</td>
                    <td>{formatTj(isoOf(c.lessonDate))}</td>
                    <td>{describeValue(c.newValue)}</td>
                    <td>{c.status === 'APPROVED' ? '✔ тасдиқ' : '✕ рад'}</td>
                    <td>{c.reviewedBy?.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </PageShell>
  );
}
