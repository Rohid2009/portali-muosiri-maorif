import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext } from '@/lib/context';
import { loadAssignment } from '@/lib/teaching';
import { PageShell, Section } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { requestCorrection } from '@/app/actions/teacher';
import { formatTj, isIsoDate, isoOf } from '@/lib/dates';
import { BEH_LABEL, describeValue } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function CorrectionPage({
  searchParams,
}: { searchParams: { a?: string; entry?: string; student?: string; date?: string; lesson?: string } }) {
  const user = await requireSchoolUser(['TEACHER']);
  const a = await loadAssignment(Number(searchParams.a) || 0, user.id, user.schoolId).catch(() => null);
  if (!a) redirect('/teacher');
  const ctx = await schoolContext(user.schoolId);

  const entry = searchParams.entry ? await db.journalEntry.findUnique({ where: { id: Number(searchParams.entry) || 0 }, include: { student: true } }) : null;
  if (entry && (entry.classId !== a.classId || entry.subjectId !== a.subjectId)) redirect(`/teacher/journal?a=${a.id}`);
  const students = await db.classEnrollment.findMany({
    where: { classId: a.classId, student: { status: 'ACTIVE' } }, include: { student: true }, orderBy: { student: { fullName: 'asc' } },
  });
  const presetStudent = Number(searchParams.student) || undefined;
  const presetDate = searchParams.date && isIsoDate(searchParams.date) ? searchParams.date : undefined;

  return (
    <PageShell user={user} title={`Дархости тасҳеҳ — ${a.subject.name}, ${a.class.name}`}>
      <Section>
        {entry ? (
          <p className="mb-4">
            <b>{entry.student.fullName}</b>, {formatTj(isoOf(entry.lessonDate))}, дарси {entry.lessonNo}.<br />
            Ҳозир: <b>{describeValue(entry)}</b>
          </p>
        ) : (
          <p className="mb-4 text-sm text-slate-600">Сабт барои рӯзе, ки баҳо ё давомот гузошта нашуда буд.</p>
        )}
        <ActionForm action={requestCorrection} submit="Фиристодан ба мутахассис">
          <input type="hidden" name="assignmentId" value={a.id} />
          {entry ? (
            <input type="hidden" name="entryId" value={entry.id} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="label">Хонанда
                <select name="studentId" defaultValue={presetStudent} className="select" required>
                  {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.student.fullName}</option>)}
                </select>
              </label>
              <label className="label">Сана<input type="date" name="lessonDate" defaultValue={presetDate} max={ctx.today} className="input" required /></label>
              <label className="label">Дарси №<input type="number" name="lessonNo" min={1} max={12} defaultValue={Number(searchParams.lesson) || 1} className="input" /></label>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="label">Баҳои дуруст
              <select name="grade" defaultValue={entry?.grade ?? ''} className="select">
                <option value="">— (бе баҳо)</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="label">Давомот
              <select name="attendance" defaultValue={entry?.attendance ?? 'PRESENT'} className="select">
                <option value="PRESENT">Ҳаст</option><option value="ABSENT">Нест</option><option value="EXCUSED">Сабабнок</option>
              </select>
            </label>
            <label className="label">Одобу рафтор
              <select name="behavior" defaultValue={entry?.behavior ?? ''} className="select">
                <option value="">—</option>
                {Object.entries(BEH_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <label className="label">Сабаб (ҳатмӣ)<textarea name="reason" rows={3} className="input" minLength={5} maxLength={500} required /></label>
        </ActionForm>
        <p className="mt-4"><Link className="text-brand underline" href={`/teacher/journal?a=${a.id}`}>← Бозгашт ба журнал</Link></p>
      </Section>
    </PageShell>
  );
}
