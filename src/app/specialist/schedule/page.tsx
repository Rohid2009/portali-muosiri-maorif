import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext, STAFF } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { PrintButton } from '@/components/PrintButton';
import { addLesson, deleteLesson } from '@/app/actions/specialist';
import { WEEKDAYS } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function SchedulePage({ searchParams }: { searchParams: { classId?: string } }) {
  const user = await requireSchoolUser(STAFF);
  const ctx = await schoolContext(user.schoolId);
  const classes = ctx.year ? await db.class.findMany({ where: { academicYearId: ctx.year.id }, orderBy: [{ gradeLevel: 'asc' }, { letter: 'asc' }] }) : [];
  const classId = Number(searchParams.classId) || classes[0]?.id;
  const cls = classes.find((c) => c.id === classId);
  const [lessons, subjects, teachers] = await Promise.all([
    cls ? db.scheduleLesson.findMany({ where: { classId: cls.id }, include: { subject: true, teacher: true }, orderBy: [{ weekday: 'asc' }, { lessonNo: 'asc' }] }) : [],
    db.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: 'asc' } }),
    db.user.findMany({ where: { schoolId: user.schoolId, role: 'TEACHER', isActive: true }, orderBy: { fullName: 'asc' } }),
  ]);
  const maxNo = Math.max(6, ...lessons.map((l) => l.lessonNo));

  return (
    <PageShell user={user} title={`Ҷадвали дарсҳо${cls ? ` — ${cls.name}` : ''}`} actions={<PrintButton />}>
      <Section>
        <div className="flex flex-wrap gap-2 print:hidden">
          {classes.map((c) => (
            <Link key={c.id} href={`/specialist/schedule?classId=${c.id}`} className={c.id === classId ? 'btn-small' : 'btn-ghost'}>{c.name}</Link>
          ))}
        </div>
        {!cls && <Empty>Синф нест.</Empty>}
      </Section>

      {cls && (
        <>
          <Section>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>№</th>
                    {[1, 2, 3, 4, 5, 6].map((d) => <th key={d}>{WEEKDAYS[d]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxNo }, (_, i) => i + 1).map((no) => (
                    <tr key={no}>
                      <td className="font-semibold">{no}</td>
                      {[1, 2, 3, 4, 5, 6].map((d) => {
                        const l = lessons.find((x) => x.weekday === d && x.lessonNo === no);
                        return (
                          <td key={d} className="min-w-[120px]">
                            {l && (
                              <div>
                                <div className="font-medium">{l.subject.name}</div>
                                <div className="text-xs text-slate-500">{l.teacher.fullName}</div>
                                <div className="text-xs text-slate-500">{l.startTime}–{l.endTime}</div>
                                <div className="print:hidden">
                                  <ActionForm action={deleteLesson} submit="Нест" variant="danger" confirm="Ин дарсро аз ҷадвал нест кунед?">
                                    <input type="hidden" name="lessonId" value={l.id} />
                                  </ActionForm>
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Илова / иваз кардани дарс">
            <div className="print:hidden">
              <ActionForm action={addLesson} submit="Сабт">
                <input type="hidden" name="classId" value={cls.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="label">Рӯз
                    <select name="weekday" className="select">{[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}</select>
                  </label>
                  <label className="label">Дарси №<input type="number" name="lessonNo" min={1} max={12} defaultValue={1} className="input" required /></label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="label">Оғоз<input type="time" name="startTime" defaultValue="08:00" className="input" required /></label>
                    <label className="label">Анҷом<input type="time" name="endTime" defaultValue="08:45" className="input" required /></label>
                  </div>
                  <label className="label">Фан
                    <select name="subjectId" className="select">{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  </label>
                  <label className="label sm:col-span-2">Омӯзгор
                    <select name="teacherId" className="select">{teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
                  </label>
                </div>
              </ActionForm>
            </div>
          </Section>
        </>
      )}
    </PageShell>
  );
}
