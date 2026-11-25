import { db } from '@/lib/db';
import { requireSchoolUser } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { formatTj, isoOf } from '@/lib/dates';
import { describeValue } from '@/lib/labels';

export const dynamic = 'force-dynamic';

const STATUS = { PENDING: '⏳ интизорӣ', APPROVED: '✔ тасдиқ', REJECTED: '✕ рад' } as const;

export default async function MyCorrections() {
  const user = await requireSchoolUser(['TEACHER']);
  const list = await db.gradeCorrection.findMany({ where: { requestedById: user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  const [students, subjects] = await Promise.all([
    db.student.findMany({ where: { id: { in: list.map((c) => c.studentId) } }, select: { id: true, fullName: true } }),
    db.subject.findMany({ where: { id: { in: list.map((c) => c.subjectId) } }, select: { id: true, name: true } }),
  ]);
  const st = new Map(students.map((s) => [s.id, s.fullName]));
  const sb = new Map(subjects.map((s) => [s.id, s.name]));
  return (
    <PageShell user={user} title="Дархостҳои ман">
      <Section>
        {list.length === 0 ? <Empty>Дархост нест.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Хонанда</th><th>Фан</th><th>Сана</th><th>Нав</th><th>Сабаб</th><th>Ҳолат</th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>{st.get(c.studentId)}</td>
                    <td>{sb.get(c.subjectId)}</td>
                    <td>{formatTj(isoOf(c.lessonDate))}</td>
                    <td>{describeValue(c.newValue)}</td>
                    <td className="max-w-xs text-xs">{c.reason}</td>
                    <td className="whitespace-nowrap">{STATUS[c.status]}</td>
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
