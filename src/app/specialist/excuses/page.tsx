import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext, STAFF } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { createExcuse } from '@/app/actions/specialist';
import { formatTj, isoOf } from '@/lib/dates';
import { storageEnabled } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export default async function ExcusesPage() {
  const user = await requireSchoolUser(STAFF);
  const ctx = await schoolContext(user.schoolId);
  const [classes, docs, unconfirmed] = await Promise.all([
    ctx.year
      ? db.class.findMany({
          where: { academicYearId: ctx.year.id },
          orderBy: [{ gradeLevel: 'asc' }, { letter: 'asc' }],
          include: { enrollments: { where: { student: { status: 'ACTIVE' } }, include: { student: true }, orderBy: { student: { fullName: 'asc' } } } },
        })
      : [],
    db.excuseDocument.findMany({ where: { schoolId: user.schoolId }, include: { student: true, reviewedBy: true }, orderBy: { createdAt: 'desc' }, take: 40 }),
    // «Нест»-ҳои 14 рӯзи охир — номзадҳо барои тасдиқ бо ҳуҷҷат
    db.journalEntry.groupBy({
      by: ['studentId'],
      where: { schoolId: user.schoolId, attendance: 'ABSENT', lessonDate: { gte: new Date(Date.now() - 14 * 86400000) } },
      _count: { _all: true },
      orderBy: { _count: { studentId: 'desc' } },
      take: 20,
    }),
  ]);
  const names = new Map(classes.flatMap((c) => c.enrollments.map((e) => [e.studentId, `${e.student.fullName} (${c.name})`] as const)));

  return (
    <PageShell user={user} title="Набудани сабабнок">
      <Section title="Сабти ҳуҷҷат (маълумотнома ва ғайра)">
        <p className="mb-3 text-sm text-slate-600">
          Ҳангоми тасдиқ ҳамаи «Нест»-ҳои хонанда дар ин давра ба «Сабабнок» иваз мешаванд.
        </p>
        <ActionForm action={createExcuse} submit="Сабт" resetOnSuccess>
          <label className="label">Хонанда
            <select name="studentId" className="select" required>
              {classes.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  {c.enrollments.map((e) => <option key={e.studentId} value={e.studentId}>{e.student.fullName}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">Аз<input type="date" name="dateFrom" className="input" required /></label>
            <label className="label">То<input type="date" name="dateTo" className="input" required /></label>
          </div>
          <label className="label">Тавзеҳ (рақами маълумотнома, сабаб)<input name="note" className="input" maxLength={500} /></label>
          {storageEnabled && (
            <label className="label">Акс ё PDF-и ҳуҷҷат (то 2 МБ)<input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="input" /></label>
          )}
          <label className="label">Қарор
            <select name="decision" className="select"><option value="approve">Тасдиқ</option><option value="reject">Рад</option></select>
          </label>
        </ActionForm>
      </Section>

      {unconfirmed.length > 0 && (
        <Section title="Бештар ғоибҳо дар 14 рӯзи охир («Нест»)">
          <ul className="text-sm">
            {unconfirmed.map((u) => <li key={u.studentId}>{names.get(u.studentId) ?? `#${u.studentId}`} — {u._count._all} дарс</li>)}
          </ul>
        </Section>
      )}

      <Section title="Ҳуҷҷатҳои охирин">
        {docs.length === 0 ? <Empty>Нест.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Хонанда</th><th>Давра</th><th>Тавзеҳ</th><th>Ҳолат</th><th>Файл</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td>{d.student.fullName}</td>
                    <td>{formatTj(isoOf(d.dateFrom))} – {formatTj(isoOf(d.dateTo))}</td>
                    <td>{d.note}</td>
                    <td>{d.status === 'APPROVED' ? '✔ тасдиқ' : d.status === 'REJECTED' ? '✕ рад' : '…'}</td>
                    <td>{d.fileKey && <a className="text-brand underline" href={`/api/excuse-file/${d.id}`} target="_blank">кушодан</a>}</td>
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
