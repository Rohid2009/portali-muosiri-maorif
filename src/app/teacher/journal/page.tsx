import { Fragment } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext } from '@/lib/context';
import { loadAssignment, todaysLessonNumbers } from '@/lib/teaching';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { PrintButton } from '@/components/PrintButton';
import { saveJournal } from '@/app/actions/teacher';
import { periodTable } from '@/lib/summary';
import { formatTj, isoOf, toDbDate } from '@/lib/dates';
import { BEH_LABEL } from '@/lib/labels';
import { GradeChip, AttendanceMark, Avatar } from '@/components/ui';
import { Icon } from '@/components/Icon';

export const dynamic = 'force-dynamic';

const GRADES = Array.from({ length: 10 }, (_, i) => i + 1);

export default async function JournalPage({ searchParams }: { searchParams: { a?: string; lesson?: string } }) {
  const user = await requireSchoolUser(['TEACHER']);
  const a = await loadAssignment(Number(searchParams.a) || 0, user.id, user.schoolId).catch(() => null);
  if (!a) redirect('/teacher');
  const ctx = await schoolContext(user.schoolId);
  const sched = await todaysLessonNumbers(a.classId, a.subjectId, user.id);
  const lessonOptions = sched.hasSchedule ? sched.numbers : [1, 2, 3, 4, 5, 6, 7, 8];
  const lessonNo = lessonOptions.includes(Number(searchParams.lesson)) ? Number(searchParams.lesson) : lessonOptions[0];
  const canWrite = !!ctx.currentQuarter && !ctx.currentQuarter.closed && lessonOptions.length > 0;

  const enr = await db.classEnrollment.findMany({
    where: { classId: a.classId, student: { status: { in: ['ACTIVE', 'ABROAD'] } } },
    include: { student: true },
    orderBy: { student: { fullName: 'asc' } },
  });

  const q = ctx.currentQuarter ?? ctx.quarters.filter((x) => x.end < ctx.today).at(-1) ?? null;
  const [todayEntries, history] = await Promise.all([
    lessonNo
      ? db.journalEntry.findMany({ where: { classId: a.classId, subjectId: a.subjectId, lessonDate: toDbDate(ctx.today), lessonNo } })
      : [],
    q
      ? db.journalEntry.findMany({
          where: { classId: a.classId, subjectId: a.subjectId, lessonDate: { gte: toDbDate(q.start), lte: toDbDate(q.end) } },
          orderBy: [{ lessonDate: 'asc' }, { lessonNo: 'asc' }],
        })
      : [],
  ]);
  const todayBy = new Map(todayEntries.map((e) => [e.studentId, e]));
  const columns = [...new Set(history.map((h) => `${isoOf(h.lessonDate)}#${h.lessonNo}`))];
  const cell = new Map(history.map((h) => [`${h.studentId}|${isoOf(h.lessonDate)}#${h.lessonNo}`, h]));
  const periods = ctx.year
    ? await periodTable({ academicYearId: ctx.year.id, quarters: ctx.quarters, examWeightPercent: ctx.settings.examWeightPercent, studentIds: enr.map((e) => e.studentId), subjectIds: [a.subjectId] })
    : new Map();

  return (
    <PageShell
      user={user}
      title={`${a.subject.name} · ${a.class.name}`}
      subtitle={`${formatTj(ctx.today)}${ctx.currentQuarter ? ` · чоряки ${ctx.currentQuarter.number}` : ''}`}
      actions={<><a className="btn-ghost" href={`/api/export?type=journal&a=${a.id}`}><Icon name="down" className="h-4 w-4" />Excel</a><PrintButton /></>}
    >
      <Link href="/teacher" className="btn-ghost -mt-2 mb-4 print:hidden"><Icon name="back" className="h-4 w-4" />Иваз кардани фан ё синф</Link>
      <Section title={`Журнали имрӯза${lessonNo ? ` · дарси ${lessonNo}` : ''}`} icon="book">
        {!ctx.currentQuarter ? (
          <Empty>Имрӯз ба ягон чоряк дохил намешавад — баҳо гузошта намешавад.</Empty>
        ) : ctx.currentQuarter.closed ? (
          <Empty>Чоряк баста шудааст.</Empty>
        ) : !canWrite ? (
          <Empty>Мувофиқи ҷадвал имрӯз шумо дар ин синф ин дарсро надоред. Барои рӯзи гузашта — «дархости тасҳеҳ».</Empty>
        ) : (
          <>
            {lessonOptions.length > 1 && (
              <div className="seg">
                {lessonOptions.map((n) => (
                  <Link key={n} href={`?a=${a.id}&lesson=${n}`} className={n === lessonNo ? 'seg-on' : ''}>Дарси {n}</Link>
                ))}
              </div>
            )}
            <ActionForm action={saveJournal} submit="Сабт кардан">
              <input type="hidden" name="assignmentId" value={a.id} />
              <input type="hidden" name="lessonNo" value={lessonNo} />
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>№</th><th>Хонанда</th><th>Баҳо</th><th>Давомот</th><th>Одобу рафтор</th></tr></thead>
                  <tbody>
                    {enr.map((e, i) => {
                      const cur = todayBy.get(e.studentId);
                      const abroad = e.student.status === 'ABROAD';
                      if (abroad) {
                        return (
                          <tr key={e.studentId} className="text-slate-400">
                            <td>{i + 1}</td><td>{e.student.fullName}</td><td colSpan={3}><span className="pill pill-gray">муваққатан дар хориҷа</span></td>
                          </tr>
                        );
                      }
                      const gradeLocked = !!cur && (cur.grade !== null || cur.attendance !== 'PRESENT');
                      return (
                        <tr key={e.studentId} className={cur ? '[&>td]:bg-green-50/70' : ''}>
                          <td className="text-slate-400">{i + 1}</td>
                          <td><span className="flex items-center gap-2.5 whitespace-nowrap font-medium"><Avatar name={e.student.fullName} />{e.student.fullName}</span></td>
                          <td>
                            {gradeLocked ? <GradeChip value={cur?.grade} empty="—" /> : (
                              <select name={`grade_${e.studentId}`} className="select w-[76px] py-1.5 font-bold" defaultValue="" aria-label="Баҳо">
                                <option value="">—</option>
                                {[...GRADES].reverse().map((g) => <option key={g} value={g}>{g}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="whitespace-nowrap">
                            {cur ? (
                              <>
                                <input type="hidden" name={`att_${e.studentId}`} value={cur.attendance} />
                                {cur.attendance === 'PRESENT' ? <span className="pill pill-green">Ҳаст</span> : cur.attendance === 'ABSENT' ? <span className="pill pill-red">Нест</span> : <span className="pill pill-amber">Сабабнок</span>}
                              </>
                            ) : (
                              <span className="att" role="radiogroup" aria-label="Давомот">
                                {([['PRESENT', 'Ҳаст', 'att-p'], ['ABSENT', 'Нест', 'att-a'], ['EXCUSED', 'Сабабнок', 'att-e']] as const).map(([v, l, c]) => (
                                  <Fragment key={v}>
                                    <input type="radio" id={`att_${e.studentId}_${v}`} name={`att_${e.studentId}`} value={v} defaultChecked={v === 'PRESENT'} />
                                    <label htmlFor={`att_${e.studentId}_${v}`} className={c}>{l}</label>
                                  </Fragment>
                                ))}
                              </span>
                            )}
                          </td>
                          <td>
                            {cur?.behavior ? <span className="pill pill-blue">{BEH_LABEL[cur.behavior]}</span> : (
                              <select name={`beh_${e.studentId}`} className="select w-[160px] py-1.5 text-sm" defaultValue="" aria-label="Одобу рафтор">
                                <option value="">—</option>
                                {Object.entries(BEH_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[13px] text-slate-500">
                Сана худкор аст. Сабти гузошташударо иваз кардан мумкин нест — барои ислоҳ дар ҷадвали поён ба катак пахш кунед ва «дархости тасҳеҳ» фиристед.
                Ба хонандаи «нест» ё «сабабнок» баҳо гузошта намешавад.
              </p>
            </ActionForm>
          </>
        )}
      </Section>

      <Section title={q ? `Журнали чоряки ${q.number}` : 'Журнал'} icon="chart">
        {columns.length === 0 ? <Empty>Ҳанӯз сабт нест.</Empty> : (
          <div className="table-wrap">
            <table className="tbl text-center">
              <thead>
                <tr>
                  <th className="text-left">Хонанда</th>
                  {columns.map((c) => {
                    const [d, n] = c.split('#');
                    return <th key={c} className="whitespace-nowrap text-xs">{formatTj(d).slice(0, 5)}{n !== '1' ? `/${n}` : ''}</th>;
                  })}
                  <th>Чоряк</th>
                </tr>
              </thead>
              <tbody>
                {enr.map((e) => (
                  <tr key={e.studentId}>
                    <td className="whitespace-nowrap text-left font-medium">{e.student.fullName}</td>
                    {columns.map((c) => {
                      const h = cell.get(`${e.studentId}|${c}`);
                      const [d, n] = c.split('#');
                      const href = h ? `/teacher/correction?a=${a.id}&entry=${h.id}` : `/teacher/correction?a=${a.id}&student=${e.studentId}&date=${d}&lesson=${n}`;
                      return (
                        <td key={c} className="nb-cell">
                          <Link href={href} title="Дархости тасҳеҳ">
                            {h ? (h.grade !== null ? <GradeChip value={h.grade} /> : <AttendanceMark value={h.attendance} />) : ''}
                          </Link>
                        </td>
                      );
                    })}
                    <td className="text-center">{q ? <GradeChip value={periods.get(`${e.studentId}:${a.subjectId}`)?.quarters[q.number - 1]} strong /> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">«н» — нест, «с» — сабабнок, «·» — ҳузур бе баҳо. Ба катак пахш кунед — дархости тасҳеҳ.</p>
        <p className="mt-2 text-sm print:hidden">
          <Link className="btn-ghost" href={`/teacher/correction?a=${a.id}`}><Icon name="plus" className="h-4 w-4" />Сабт барои рӯзи гузашта</Link>
        </p>
      </Section>

      <Section title="Баҳоҳои чорякӣ ва солона" icon="star">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Хонанда</th><th>Ч1</th><th>Ч2</th><th>Ч3</th><th>Ч4</th><th>Имтиҳон</th><th>Солона</th></tr></thead>
            <tbody>
              {enr.map((e) => {
                const r = periods.get(`${e.studentId}:${a.subjectId}`);
                return (
                  <tr key={e.studentId}>
                    <td>{e.student.fullName}</td>
                    {[0, 1, 2, 3].map((i) => <td key={i}><GradeChip value={r?.quarters[i]} empty="—" /></td>)}
                    <td><GradeChip value={r?.exam} empty="—" /></td>
                    <td><GradeChip value={r?.annual} strong /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </PageShell>
  );
}
