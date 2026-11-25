import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext, STAFF } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { addClasses, renameClass, deleteClass } from '@/app/actions/specialist';

export const dynamic = 'force-dynamic';

export default async function ClassesPage() {
  const user = await requireSchoolUser(STAFF);
  const ctx = await schoolContext(user.schoolId);
  const classes = ctx.year
    ? await db.class.findMany({
        where: { academicYearId: ctx.year.id },
        orderBy: [{ gradeLevel: 'asc' }, { letter: 'asc' }],
        include: { _count: { select: { enrollments: true } } },
      })
    : [];
  return (
    <PageShell user={user} title={`Синфҳо${ctx.year ? ` — ${ctx.year.name}` : ''}`}>
      {!ctx.year ? (
        <Section><Empty>Аввал <Link className="text-brand underline" href="/specialist/years">соли таҳсил</Link>-ро созед.</Empty></Section>
      ) : (
        <>
          <Section title="Илова кардан">
            <ActionForm action={addClasses} submit="Илова" resetOnSuccess>
              <label className="label">
                Номҳо (бо вергул ё ҳар кадом дар сатри нав). «10a», «10 а», «10-А» — ҳама ба «10-А» табдил меёбанд.
                <textarea name="names" rows={3} className="input" placeholder="1-А, 1-Б, 2-А, 5-В, 10-А" required />
              </label>
            </ActionForm>
          </Section>
          <Section title={`Рӯйхат (${classes.length})`}>
            {classes.length === 0 ? <Empty>Ҳанӯз синф нест.</Empty> : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Link href={`/specialist/students?classId=${c.id}`} className="text-xl font-bold text-brand hover:underline">{c.name}</Link>
                      <span className="pill pill-gray">{c._count.enrollments} хонанда</span>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-[13px] font-semibold text-brand">Таҳрир / нест кардан</summary>
                      <div className="mt-2 space-y-2">
                        <ActionForm action={renameClass} submit="Сабт" variant="small" className="flex gap-2">
                          <input type="hidden" name="classId" value={c.id} />
                          <input name="name" defaultValue={c.name} className="input" required aria-label="Номи синф" />
                        </ActionForm>
                        <ActionForm action={deleteClass} submit="Нест кардани синф" variant="danger" confirm={`${c.name}-ро нест мекунед? Танҳо синфи холӣ нест мешавад.`}>
                          <input type="hidden" name="classId" value={c.id} />
                        </ActionForm>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </PageShell>
  );
}
