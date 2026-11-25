import { requireSchoolUser, STAFF } from '@/lib/context';
import { PageShell, Section } from '@/components/PageShell';

export const dynamic = 'force-dynamic';

const TABLES = [
  { key: 'students', label: 'Хонандагон ва синфҳо' },
  { key: 'teachers', label: 'Омӯзгорон ва тақсимот' },
  { key: 'journal', label: 'Журнал (ҳамаи баҳоҳо ва давомот, соли ҷорӣ)' },
  { key: 'periods', label: 'Баҳоҳои чорякӣ, имтиҳон ва солона' },
  { key: 'schedule', label: 'Ҷадвали дарсҳо' },
  { key: 'corrections', label: 'Дархостҳои тасҳеҳ' },
  { key: 'audit', label: 'Сабти тағйирот' },
];

export default async function ExportPage() {
  const user = await requireSchoolUser(STAFF);
  return (
    <PageShell user={user} title="Содироти маълумот">
      <Section>
        <p className="mb-4 text-sm text-slate-600">
          Файлҳо дар формати CSV (Excel онҳоро мекушояд). Барои PDF дар ҳар саҳифаи ҳисобот тугмаи «Чоп / PDF»-ро пахш кунед ва «Сохранить как PDF»-ро интихоб кунед.
          Ин нусхаи иловагии маълумоти мактаб аст — онро дар ҷои бехатар нигоҳ доред.
        </p>
        <ul className="space-y-2">
          {TABLES.filter((t) => t.key !== 'audit' || user.role === 'DIRECTOR').map((t) => (
            <li key={t.key}>
              <a className="btn-ghost" href={`/api/export?type=all&table=${t.key}`}>⬇ {t.label}</a>
            </li>
          ))}
        </ul>
      </Section>
    </PageShell>
  );
}
