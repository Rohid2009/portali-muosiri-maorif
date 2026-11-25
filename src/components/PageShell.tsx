import type { CurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { AppHeader } from './AppHeader';
import { Icon, type IconName } from './Icon';
import { unreadChats } from '@/lib/chat';

const NAV: Record<CurrentUser['role'], { href: string; label: string }[]> = {
  SPECIALIST: [
    { href: '/specialist', label: 'Асосӣ' },
    { href: '/specialist/years', label: 'Сол ва чорякҳо' },
    { href: '/specialist/subjects', label: 'Фанҳо' },
    { href: '/specialist/classes', label: 'Синфҳо' },
    { href: '/specialist/teachers', label: 'Омӯзгорон' },
    { href: '/specialist/students', label: 'Хонандагон' },
    { href: '/specialist/parents', label: 'Волидон' },
    { href: '/specialist/schedule', label: 'Ҷадвал' },
    { href: '/specialist/corrections', label: 'Дархостҳо' },
    { href: '/specialist/excuses', label: 'Сабабнок' },
    { href: '/specialist/grades', label: 'Чорякӣ' },
    { href: '/specialist/year-end', label: 'Охири сол' },
    { href: '/specialist/settings', label: 'Танзимот' },
    { href: '/specialist/export', label: 'Содирот' },
  ],
  DIRECTOR: [
    { href: '/director', label: 'Ҳисобот' },
    { href: '/director/staff', label: 'Мутахассисон' },
    { href: '/director/audit', label: 'Сабти тағйирот' },
  ],
  TEACHER: [
    { href: '/teacher', label: 'Журнал' },
    { href: '/chat', label: 'Чат' },
    { href: '/teacher/parents', label: 'Волидон' },
    { href: '/teacher/corrections', label: 'Дархостҳои ман' },
  ],
  PARENT: [
    { href: '/parent', label: 'Фарзандон' },
    { href: '/chat', label: 'Чат' },
    { href: '/parent/teachers', label: 'Омӯзгорон' },
  ],
  DISTRICT_ADMIN: [
    { href: '/admin', label: 'Мактабҳо' },
    { href: '/admin/report', label: 'Ҳисоботи ноҳия' },
  ],
};

export async function PageShell({
  user, title, subtitle, children, actions,
}: {
  user: CurrentUser;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  // Мудир ҳам ба саҳифаҳои мутахассис дастрасӣ дорад — менюи ҳардуро мебинад
  const unread = await unreadChats(user);
  const nav = [
    ...(user.role === 'DIRECTOR' ? [...NAV.DIRECTOR, ...NAV.SPECIALIST] : NAV[user.role]),
    { href: '/change-password', label: 'Логин ва парол' },
  ].map((n) => (n.href === '/chat' && unread > 0 ? { ...n, label: `Чат (${unread})` } : n));
  const school = user.schoolId ? await db.school.findUnique({ where: { id: user.schoolId }, select: { name: true, district: true } }) : null;
  return (
    <>
      <AppHeader user={user} schoolName={school?.name} schoolSub={school ? `${school.district}, Портали муосири маориф` : null} nav={nav} />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[clamp(24px,3.2vw,34px)] font-extrabold leading-tight tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
        </div>
        {children}
      </main>
    </>
  );
}

export function Section({ title, icon, children }: { title?: string; icon?: IconName; children: React.ReactNode }) {
  return (
    <section className="card">
      {title && (
        <h2 className="card-title">
          {icon && <span className="text-brand dark:text-[#5cc8ff]"><Icon name={icon} /></span>}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-500">{children}</p>;
}
