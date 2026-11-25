import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext, STAFF } from '@/lib/context';
import { PageShell, Section } from '@/components/PageShell';
import { formatTj } from '@/lib/dates';
import { StatCard, Stats, Bar } from '@/components/ui';
import { Icon } from '@/components/Icon';

export const dynamic = 'force-dynamic';

export default async function SpecialistHome() {
  const user = await requireSchoolUser(STAFF);
  const ctx = await schoolContext(user.schoolId);
  const s = user.schoolId;
  const [school, teachers, students, classes, pending, unassigned, parentReqs] = await Promise.all([
    db.school.findUnique({ where: { id: s } }),
    db.user.count({ where: { schoolId: s, role: 'TEACHER', isActive: true } }),
    ctx.year ? db.classEnrollment.count({ where: { academicYearId: ctx.year.id, student: { status: 'ACTIVE' } } }) : 0,
    ctx.year ? db.class.count({ where: { academicYearId: ctx.year.id } }) : 0,
    db.gradeCorrection.count({ where: { schoolId: s, status: 'PENDING' } }),
    db.user.count({ where: { schoolId: s, role: 'TEACHER', isActive: true, teachingAssignments: { none: { activeTo: null } } } }),
    db.parentLinkRequest.count({ where: { schoolId: s, status: 'PENDING' } }),
  ]);

  const steps = [
    { done: !!ctx.year, href: '/specialist/years', text: 'Соли таҳсил ва санаҳои чорякҳо' },
    { done: classes > 0, href: '/specialist/classes', text: 'Синфҳо' },
    { done: teachers > 0, href: '/specialist/teachers', text: 'Омӯзгорон ва тақсими фан/синф' },
    { done: students > 0, href: '/specialist/students', text: 'Хонандагон ва ҳисоби волидон' },
  ];

  const doneCount = steps.filter((x) => x.done).length;
  return (
    <PageShell
      user={user}
      title={school?.name ?? 'Мутахассис'}
      subtitle={ctx.year ? <>Соли таҳсили {ctx.year.name}{ctx.currentQuarter && <> · чоряки {ctx.currentQuarter.number} ({formatTj(ctx.currentQuarter.start)} – {formatTj(ctx.currentQuarter.end)})</>}</> : 'Соли таҳсил сохта нашудааст'}
    >
      <Stats>
        <StatCard icon="users" value={teachers} label="Омӯзгорон" href="/specialist/teachers" />
        <StatCard icon="family" tone="green" value={students} label="Хонандагон" href="/specialist/students" />
        <StatCard icon="book" value={classes} label="Синфҳо" href="/specialist/classes" />
        <StatCard icon="inbox" tone="gold" value={pending} label="Дархостҳо" href="/specialist/corrections" alert={pending > 0} />
      </Stats>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Омодагии соли таҳсил" icon="check">
          <div className="mb-3"><Bar percent={(doneCount / steps.length) * 100} className="bg-green-600" /></div>
          <ol className="space-y-1">
            {steps.map((st, i) => (
              <li key={st.href}>
                <Link href={st.href} className="flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-slate-50">
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold ${st.done ? 'bg-green-100 text-green-700' : 'border-[1.5px] border-slate-200 bg-slate-50 text-slate-500'}`}>
                    {st.done ? <Icon name="check" className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={st.done ? '' : 'font-semibold'}>{st.text}</span>
                  {!st.done && <span className="ml-auto text-brand"><Icon name="arrow" /></span>}
                </Link>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Ҳолат" icon="alert">
          {!ctx.year && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Аввал соли таҳсил ва санаҳои чорякҳоро созед.</p>}
          {ctx.year && !ctx.currentQuarter && <p className="mb-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Имрӯз ба ягон чоряк дохил намешавад (таътил).</p>}
          {ctx.currentQuarter?.closed && <p className="mb-2 rounded-xl bg-slate-100 px-4 py-3 text-sm">Чоряки ҷорӣ баста шудааст.</p>}
          {unassigned > 0 && <p className="mb-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{unassigned} омӯзгор ҳанӯз фан ва синф надорад.</p>}
          {parentReqs > 0 && <p className="mb-2 rounded-xl bg-gold-light px-4 py-3 text-sm text-amber-900"><Link href="/specialist/parents" className="font-semibold underline">{parentReqs} дархости волидон</Link> интизори тасдиқ аст.</p>}
          {pending > 0 && <p className="mb-2 rounded-xl bg-gold-light px-4 py-3 text-sm text-amber-900"><Link href="/specialist/corrections" className="font-semibold underline">{pending} дархости тасҳеҳ</Link> интизори баррасӣ аст.</p>}
          {ctx.year && ctx.currentQuarter && !ctx.currentQuarter.closed && unassigned === 0 && pending === 0 && parentReqs === 0 && (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">Ҳама чиз тартиб аст.</p>
          )}
        </Section>
      </div>
    </PageShell>
  );
}
