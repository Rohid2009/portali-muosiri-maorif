import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { Icon } from '@/components/Icon';
import { toDbDate, weekdayOf, WEEKDAYS, formatTj } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function TeacherHome() {
  const user = await requireSchoolUser(['TEACHER']);
  const ctx = await schoolContext(user.schoolId);
  const today = toDbDate(ctx.today);
  const [assignments, lessons] = await Promise.all([
    db.teachingAssignment.findMany({
      where: { teacherId: user.id, activeFrom: { lte: today }, OR: [{ activeTo: null }, { activeTo: { gte: today } }], academicYear: { isCurrent: true } },
      include: { class: true, subject: true },
      orderBy: [{ subject: { name: 'asc' } }, { class: { gradeLevel: 'asc' } }],
    }),
    db.scheduleLesson.findMany({
      where: { teacherId: user.id, weekday: weekdayOf(ctx.today) },
      include: { class: true, subject: true },
      orderBy: { lessonNo: 'asc' },
    }),
  ]);
  // Вақти ҳозира дар Душанбе — барои қайд кардани дарси ҷорӣ
  const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dushanbe', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());

  return (
    <PageShell
      user={user}
      title={`Салом, ${user.fullName.split(' ').slice(1, 3).join(' ') || user.fullName}!`}
      subtitle={`${WEEKDAYS[weekdayOf(ctx.today)]}, ${formatTj(ctx.today)}${ctx.currentQuarter ? ` · чоряки ${ctx.currentQuarter.number}` : ''}`}
    >
      {!ctx.currentQuarter && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="alert" /> Имрӯз таътил аст ё санаҳои чорякҳо муқаррар нашудаанд — баҳо гузошта намешавад.
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Link href="/teacher/parents" className="stat hover:border-brand"><span className="grid h-11 w-11 place-items-center rounded-xl bg-green-100 text-green-700"><Icon name="family" /></span><span><b className="block">Волидон</b><span className="text-[13px] text-slate-500">рӯйхат ва телефонҳо</span></span></Link>
        <Link href="/chat" className="stat hover:border-brand"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-light text-brand"><Icon name="inbox" /></span><span><b className="block">Чат</b><span className="text-[13px] text-slate-500">паём ба волидон</span></span></Link>
      </div>

      <Section title="Дарсҳои имрӯза" icon="cal">
        {lessons.length > 0 ? (
          <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
            {lessons.map((l) => {
              const a = assignments.find((x) => x.classId === l.classId && x.subjectId === l.subjectId);
              const current = l.startTime <= now && now <= l.endTime;
              const inner = (
                <>
                  <span className="text-xs tabular-nums text-slate-500">{l.lessonNo}-ум дарс · {l.startTime}</span>
                  <b className="block text-sm">{l.subject.name}</b>
                  <span className="text-[13px] text-slate-500">{l.class.name}{current && ' · ҳозир'}</span>
                </>
              );
              const cls = `block min-w-[150px] shrink-0 rounded-2xl border-[1.5px] px-3 py-2.5 ${current ? 'border-brand bg-brand-light' : 'border-slate-200 bg-slate-50'} ${a ? 'hover:border-brand' : ''}`;
              return a ? <Link key={l.id} href={`/teacher/journal?a=${a.id}`} className={cls}>{inner}</Link> : <div key={l.id} className={cls}>{inner}</div>;
            })}
          </div>
        ) : <Empty>Мувофиқи ҷадвал имрӯз дарс надоред.</Empty>}
      </Section>

      <Section title="Интихоби фан ва синф" icon="book">
        <p className="-mt-2 mb-4 text-[13px] text-slate-500">Танҳо фан ва синфҳое, ки мутахассис ба шумо вобаста кардааст.</p>
        {assignments.length === 0 ? (
          <Empty>Ба шумо ҳанӯз фан ва синф тақсим нашудааст. Ба мутахассис муроҷиат кунед.</Empty>
        ) : (
          <>
            <form action="/teacher/journal" className="mb-4 flex flex-wrap items-end gap-3">
              <label className="label flex-1">Фан ва синф
                <select name="a" className="select w-full">
                  {assignments.map((a) => <option key={a.id} value={a.id}>{a.subject.name} — {a.class.name}</option>)}
                </select>
              </label>
              <button type="submit" className="btn-small min-h-[46px] px-7">OK</button>
            </form>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {assignments.map((a) => (
                <Link key={a.id} href={`/teacher/journal?a=${a.id}`} className="group flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 hover:border-brand hover:bg-brand-light">
                  <span><b className="block text-lg leading-tight">{a.class.name}</b><span className="text-[13px] text-slate-500">{a.subject.name}</span></span>
                  <span className="text-brand opacity-60 group-hover:opacity-100"><Icon name="arrow" /></span>
                </Link>
              ))}
            </div>
          </>
        )}
      </Section>
    </PageShell>
  );
}
