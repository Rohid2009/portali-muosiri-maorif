import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { PrintButton } from '@/components/PrintButton';
import { classReport } from '@/lib/reports';
import { schoolContext } from '@/lib/context';

export const dynamic = 'force-dynamic';

/** Ҳисоботи ноҳия: ҳар мактаб — чоряки ҷорӣ */
export default async function DistrictReport() {
  const user = await requireRole(['DISTRICT_ADMIN']);
  const schools = await db.school.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  const rows = await Promise.all(
    schools.map(async (s) => {
      const ctx = await schoolContext(s.id);
      const q = ctx.currentQuarter ?? ctx.quarters.filter((x) => x.end < ctx.today).at(-1);
      if (!ctx.year || !q) return { school: s.name, q: null as number | null, students: 0, avg: null as number | null, att: null as number | null };
      const r = await classReport(s.id, ctx.year.id, q.start, q.end);
      const students = r.reduce((a, x) => a + x.students, 0);
      const grades = r.reduce((a, x) => a + x.grades, 0);
      const avg = grades ? r.reduce((a, x) => a + (x.avgGrade ?? 0) * x.grades, 0) / grades : null;
      const p = r.reduce((a, x) => a + x.present, 0);
      const t = r.reduce((a, x) => a + x.present + x.absent + x.excused, 0);
      return { school: s.name, q: q.number, students, avg, att: t ? (p / t) * 100 : null };
    }),
  );
  return (
    <PageShell user={user} title="Ҳисоботи ноҳия" actions={<PrintButton />}>
      <Section>
        {rows.length === 0 ? <Empty>Мактаб нест.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Мактаб</th><th>Чоряк</th><th>Хонандагон</th><th>Баҳои миёна</th><th>Давомот</th></tr></thead>
              <tbody>
                {rows.sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)).map((r) => (
                  <tr key={r.school}>
                    <td>{r.school}</td>
                    <td>{r.q ?? '—'}</td>
                    <td>{r.students}</td>
                    <td>{r.avg !== null ? r.avg.toFixed(2) : '—'}</td>
                    <td>{r.att !== null ? `${r.att.toFixed(1)}%` : '—'}</td>
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
