import { db } from '@/lib/db';
import { requireSchoolUser, STAFF } from '@/lib/context';
import { PageShell, Section } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { QuarterInputs } from '@/components/QuarterInputs';
import { createYear, updateQuarter, setCurrentYear, closeQuarter, reopenQuarter } from '@/app/actions/specialist';
import { formatTj, isoOf } from '@/lib/dates';

export const dynamic = 'force-dynamic';
// Сохтани паролҳо (bcrypt) ва гузариши сол вақт мегирад
export const maxDuration = 60;

export default async function YearsPage() {
  const user = await requireSchoolUser(STAFF);
  const years = await db.academicYear.findMany({
    where: { schoolId: user.schoolId },
    include: { quarters: { orderBy: { number: 'asc' } } },
    orderBy: { startDate: 'desc' },
  });

  return (
    <PageShell user={user} title="Соли таҳсил ва чорякҳо">
      {years.map((y) => (
        <Section key={y.id} title={`${y.name}${y.isCurrent ? ' — ҷорӣ' : ''}${y.isClosed ? ' (баста)' : ''}`}>
          <div className="space-y-3">
            {y.quarters.map((q) => (
              <div key={q.id} className="flex flex-wrap items-end gap-3 border-b border-slate-100 pb-3">
                <div className="w-24 font-semibold">Чоряки {q.number}</div>
                {q.isClosed || y.isClosed ? (
                  <div className="text-slate-600">{formatTj(isoOf(q.startDate))} – {formatTj(isoOf(q.endDate))} <span className="badge bg-slate-200">баста</span></div>
                ) : (
                  <ActionForm action={updateQuarter} submit="Нав кардан" variant="small" className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="quarterId" value={q.id} />
                    <input type="date" name="start" defaultValue={isoOf(q.startDate)} className="input w-auto" required />
                    <input type="date" name="end" defaultValue={isoOf(q.endDate)} className="input w-auto" required />
                  </ActionForm>
                )}
                {!y.isClosed && (q.isClosed ? (
                  <ActionForm action={reopenQuarter} submit="Кушодан" variant="small" confirm="Чорякро кушоед? Баҳоҳои чоряки сабтшуда нест мешаванд ва аз нав ҳисоб мешаванд.">
                    <input type="hidden" name="quarterId" value={q.id} />
                  </ActionForm>
                ) : (
                  <ActionForm action={closeQuarter} submit="Бастани чоряк" variant="small" confirm="Чорякро мебандед? Баҳоҳои чорякӣ ҳисоб ва сабт мешаванд.">
                    <input type="hidden" name="quarterId" value={q.id} />
                  </ActionForm>
                ))}
              </div>
            ))}
          </div>
          {!y.isCurrent && !y.isClosed && (
            <div className="mt-3">
              <ActionForm action={setCurrentYear} submit="Соли ҷорӣ кардан" variant="small">
                <input type="hidden" name="yearId" value={y.id} />
              </ActionForm>
            </div>
          )}
        </Section>
      ))}

      <Section title="Соли таҳсили нав">
        {years.some((y) => y.isCurrent) && (
          <p className="mb-3 text-sm text-slate-600">
            Барои гузаронидани хонандагон ба соли нав саҳифаи «Охири сол»-ро истифода баред. Ин форма танҳо соли холӣ месозад.
          </p>
        )}
        <ActionForm action={createYear} submit="Сохтан">
          <label className="label">Ном<input name="name" placeholder="2026-2027" className="input" required /></label>
          <QuarterInputs />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="current" /> Соли ҷорӣ кардан</label>
        </ActionForm>
      </Section>
    </PageShell>
  );
}
