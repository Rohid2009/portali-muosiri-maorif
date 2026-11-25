import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext, STAFF } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { QuarterInputs } from '@/components/QuarterInputs';
import { saveYearResults, startNewYear } from '@/app/actions/specialist';
import { periodTable } from '@/lib/summary';

export const dynamic = 'force-dynamic';
// Сохтани паролҳо (bcrypt) ва гузариши сол вақт мегирад
export const maxDuration = 60;

const RESULT: Record<string, string> = { PROMOTED: 'Мегузарад', REPEATED: 'Бозмонд', EXPELLED: 'Хориҷ', GRADUATED: 'Хатм' };

export default async function YearEndPage() {
  const user = await requireSchoolUser(STAFF);
  const ctx = await schoolContext(user.schoolId);
  const pastYears = await db.academicYear.findMany({
    where: { schoolId: user.schoolId, isClosed: true },
    orderBy: { startDate: 'desc' },
    include: { classes: { orderBy: [{ gradeLevel: 'asc' }, { letter: 'asc' }] } },
  });
  if (!ctx.year) return <PageShell user={user} title="Охири сол"><Section><Empty>Соли ҷорӣ нест.</Empty></Section></PageShell>;

  const classes = await db.class.findMany({
    where: { academicYearId: ctx.year.id },
    orderBy: [{ gradeLevel: 'asc' }, { letter: 'asc' }],
    include: { enrollments: { include: { student: true }, orderBy: { student: { fullName: 'asc' } } } },
  });
  // Барои пешниҳоди «бозмонд»: шумораи фанҳо бо баҳои солона ≤ 3
  const allIds = classes.flatMap((c) => c.enrollments.map((e) => e.studentId));
  const table = await periodTable({ academicYearId: ctx.year.id, quarters: ctx.quarters, examWeightPercent: ctx.settings.examWeightPercent, studentIds: allIds });
  const failing = new Map<number, number>();
  for (const [k, r] of table) {
    const sid = Number(k.split(':')[0]);
    if (r.annual !== null && r.annual <= 3) failing.set(sid, (failing.get(sid) ?? 0) + 1);
  }

  return (
    <PageShell user={user} title={`Охири соли таҳсил — ${ctx.year.name}`}>
      <Section>
        <ol className="list-inside list-decimal space-y-1 text-sm text-slate-700">
          <li>Чоряки 4-ро бандед (Сол ва чорякҳо).</li>
          <li>Барои ҳар синф натиҷаи солро интихоб ва сабт кунед. Хонандагони дорои баҳои солонаи ≤ 3 сурх нишон дода шудаанд.</li>
          <li>Соли навро оғоз кунед — синфҳо +1, бозмондагон дар ҳамон синф, хатмкунандагон ва хориҷшудагон дар таърих мемонанд.</li>
        </ol>
      </Section>

      {classes.map((c) => (
        <Section key={c.id} title={c.name}>
          {c.enrollments.length === 0 ? <Empty>Хонанда нест.</Empty> : (
            <ActionForm action={saveYearResults} submit={`Сабти натиҷаҳои ${c.name}`} variant="small">
              <input type="hidden" name="classId" value={c.id} />
              <div className="table-wrap">
                <table className="tbl">
                  <tbody>
                    {c.enrollments.map((e) => {
                      const def = e.yearResult ?? (e.student.status === 'EXPELLED' ? 'EXPELLED' : c.gradeLevel >= 11 ? 'GRADUATED' : 'PROMOTED');
                      const fails = failing.get(e.studentId) ?? 0;
                      return (
                        <tr key={e.id} className={fails ? 'bg-red-50' : ''}>
                          <td>{e.student.fullName}{fails > 0 && <span className="ml-2 text-xs text-red-700">{fails} фан ≤ 3</span>}</td>
                          <td className="w-44">
                            <select name={`r_${e.id}`} defaultValue={def} className="select py-1">
                              {Object.entries(RESULT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </td>
                          <td className="w-20 text-xs text-slate-500">{e.yearResult ? '✔ сабт' : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ActionForm>
          )}
        </Section>
      ))}

      <Section title="Оғози соли нав">
        <ActionForm action={startNewYear} submit="Оғози соли нав" confirm="Соли ҷорӣ баста мешавад ва хонандагон гузаронида мешаванд. Идома диҳед?">
          <label className="label">Номи соли нав<input name="name" placeholder="2027-2028" className="input" required /></label>
          <QuarterInputs />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="copyAssignments" defaultChecked /> Тақсимоти омӯзгоронро ба синфҳои нав нусха кунед (5-А → 6-А)
          </label>
        </ActionForm>
      </Section>

      {pastYears.length > 0 && (
        <Section title="Таърихи солҳои гузашта">
          {pastYears.map((y) => (
            <div key={y.id} className="mb-2">
              <b>{y.name}:</b>{' '}
              {y.classes.map((c) => (
                <Link key={c.id} href={`/specialist/grades/class/${c.id}?p=annual`} className="mr-2 text-brand underline">{c.name}</Link>
              ))}
            </div>
          ))}
        </Section>
      )}
    </PageShell>
  );
}
