import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSchoolUser } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';

export const dynamic = 'force-dynamic';

const PAGE = 50;

const ACTIONS: Record<string, string> = {
  'auth.login': 'Воридшавӣ',
  'auth.login_failed': 'Воридшавии ноком',
  'auth.locked': 'Ҳисоб қуфл шуд',
  'auth.logout': 'Баромад',
  'password.change': 'Иваз кардани парол',
  'password.reset': 'Пароли нав (аз ҷониби масъул)',
  'journal.save': 'Сабти журнал',
  'correction.request': 'Дархости тасҳеҳ',
  'correction.approve': 'Тасдиқи тасҳеҳ',
  'correction.reject': 'Рад кардани тасҳеҳ',
  'assignment.create': 'Тақсими фан/синф',
  'assignment.end': 'Қатъи тақсимот',
  'teacher.transfer': 'Интиқоли омӯзгор',
  'student.create': 'Иловаи хонанда',
  'student.update': 'Тағйири хонанда',
  'user.create': 'Сохтани ҳисоб',
  'quarter.close': 'Бастани чоряк',
  'year.transition': 'Гузариш ба соли нав',
  'excuse.approve': 'Тасдиқи сабабнок',
  'exam.set': 'Баҳои имтиҳон',
  'schedule.set': 'Ҷадвал',
  'settings.update': 'Танзимот',
  'parent.signup': 'Сабти номи волид',
  'parent.link_request': 'Дархости иловаи фарзанд',
  'parent.link_approve': 'Тасдиқи волид',
  'parent.link_reject': 'Радди волид',
  'parent.unlink': 'Ҷудо кардани волид',
  'credentials.set': 'Ивази логин/парол аз ҷониби масъул',
  'contact.update': 'Тағйири рақами телефон',
  'chat.send': 'Паём дар чат (матн сабт намешавад)',
  'login.change': 'Ивази логини худ',
  'login.change_failed': 'Кӯшиши ноками ивази логин',
  'user.rename': 'Иваз кардани ном',
  'user.delete': 'Нест кардани ҳисоб',
  'user.archive': 'Ба бойгонӣ гузаронидан',
  'assignment.update': 'Таҳрири тақсимот',
  'assignment.delete': 'Нест кардани тақсимот',
  'subject.delete': 'Нест кардани фан',
  'class.rename': 'Иваз кардани номи синф',
  'class.delete': 'Нест кардани синф',
  'student.delete': 'Нест кардани хонанда',
};

export default async function AuditPage({ searchParams }: { searchParams: { page?: string; action?: string } }) {
  const user = await requireSchoolUser(['DIRECTOR']);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const action = searchParams.action && ACTIONS[searchParams.action] ? searchParams.action : undefined;
  const where = { schoolId: user.schoolId, ...(action ? { action } : {}) };
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ where, include: { actor: { select: { fullName: true, role: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE, take: PAGE }),
    db.auditLog.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => `?page=${p}${action ? `&action=${action}` : ''}`;

  return (
    <PageShell user={user} title="Сабти тағйирот" actions={<a className="btn-ghost" href="/api/export?type=all&table=audit">⬇ Excel (CSV)</a>}>
      <Section>
        <form className="mb-4 flex gap-2" action="/director/audit">
          <select name="action" defaultValue={action ?? ''} className="select">
            <option value="">Ҳамаи амалҳо</option>
            {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-small" type="submit">Филтр</button>
        </form>
        {rows.length === 0 ? <Empty>Сабт нест.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Вақт</th><th>Кӣ</th><th>Чӣ</th><th>Тафсилот</th><th>IP</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td className="whitespace-nowrap text-xs">{r.createdAt.toLocaleString('ru-RU', { timeZone: 'Asia/Dushanbe' })}</td>
                    <td className="text-sm">{r.actor?.fullName ?? '—'}</td>
                    <td className="text-sm">{ACTIONS[r.action] ?? r.action}</td>
                    <td className="max-w-md truncate font-mono text-xs" title={r.details ? JSON.stringify(r.details) : ''}>
                      {r.entity ? `${r.entity}#${r.entityId} ` : ''}{r.details ? JSON.stringify(r.details).slice(0, 160) : ''}
                    </td>
                    <td className="text-xs">{r.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && <Link className="btn-ghost" href={qs(page - 1)}>← Пеш</Link>}
          <span>Саҳифаи {page} аз {pages} ({total} сабт)</span>
          {page < pages && <Link className="btn-ghost" href={qs(page + 1)}>Баъд →</Link>}
        </div>
        <p className="mt-3 text-xs text-slate-500">Сабтҳо тағйирнашавандаанд: база иваз ё нест кардани онҳоро манъ мекунад.</p>
      </Section>
    </PageShell>
  );
}
