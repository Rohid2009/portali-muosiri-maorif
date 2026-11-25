import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { Avatar } from '@/components/ui';
import { Icon } from '@/components/Icon';

export const dynamic = 'force-dynamic';

export default async function ParentHome() {
  const user = await requireRole(['PARENT']);
  const [links, requests] = await Promise.all([
    db.parentStudent.findMany({
      where: { parentUserId: user.id },
      include: {
        school: true,
        student: { include: { enrollments: { where: { academicYear: { isCurrent: true } }, include: { class: true } } } },
      },
    }),
    db.parentLinkRequest.findMany({
      where: { parentUserId: user.id, status: { in: ['PENDING', 'REJECTED'] } },
      include: { student: { include: { enrollments: { where: { academicYear: { isCurrent: true } }, include: { class: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  // Агар танҳо як фарзанд ва дархости интизорӣ набошад — рост ба саҳифаи ӯ
  if (links.length === 1 && !requests.some((r) => r.status === 'PENDING')) redirect(`/parent/child/${links[0].studentId}`);

  return (
    <PageShell
      user={user}
      title="Фарзандони ман"
      actions={<Link href="/parent/add" className="btn-small"><Icon name="plus" className="h-4 w-4" />Иловаи фарзанд</Link>}
    >
      <Section>
        {links.length === 0 ? (
          <Empty>Ҳоло ягон фарзанд тасдиқ нашудааст. {requests.length === 0 && <Link className="font-semibold text-brand underline" href="/parent/add">Фарзанди худро интихоб кунед.</Link>}</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {links.map((l) => (
              <li key={l.studentId}>
                <Link href={`/parent/child/${l.studentId}`} className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-4 hover:border-brand hover:bg-brand-light">
                  <Avatar name={l.student.fullName} size="md" />
                  <span className="min-w-0 flex-1">
                    <b className="block text-lg leading-tight">{l.student.fullName}</b>
                    <span className="text-sm text-slate-500">{l.school.name} · {l.student.enrollments[0]?.class.name ?? '—'}</span>
                  </span>
                  <span className="text-brand"><Icon name="arrow" /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Link href="/parent/teachers" className="stat hover:border-brand"><span className="grid h-11 w-11 place-items-center rounded-xl bg-green-100 text-green-700"><Icon name="users" /></span><span><b className="block">Омӯзгорон</b><span className="text-[13px] text-slate-500">рӯйхат ва телефонҳо</span></span></Link>
        <Link href="/chat" className="stat hover:border-brand"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-light text-brand"><Icon name="inbox" /></span><span><b className="block">Чат</b><span className="text-[13px] text-slate-500">паём ба омӯзгорон</span></span></Link>
      </div>

      {requests.length > 0 && (
        <Section title="Дархостҳо" icon="inbox">
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => {
              const parts = r.student.fullName.split(' ');
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex-1">{parts[1] ?? parts[0]} {parts[0][0]}. <span className="text-sm text-slate-500">· {r.student.enrollments[0]?.class.name}</span></span>
                  {r.status === 'PENDING'
                    ? <span className="pill pill-amber">интизори тасдиқи мутахассис</span>
                    : <span className="pill pill-red">рад шуд — ба мактаб муроҷиат кунед</span>}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </PageShell>
  );
}
