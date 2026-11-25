import Link from 'next/link';
import { db } from '@/lib/db';
import { currentTheme } from '@/lib/theme';
import { Icon, Logo, type IconName } from './Icon';
import { ThemeToggle } from './ThemeToggle';

const NAV: { key: string; href: string; label: string; icon: IconName }[] = [
  { key: 'home', href: '/', label: 'Асосӣ', icon: 'house' },
  { key: 'teacher', href: '/login?as=teacher', label: 'Омӯзгор', icon: 'book' },
  { key: 'parent', href: '/login?as=parent', label: 'Волид', icon: 'family' },
  { key: 'staff', href: '/login?as=staff', label: 'Мутахассис', icon: 'clip' },
  { key: 'director', href: '/login?as=staff&r=director', label: 'Мудир', icon: 'chart' },
];

/** Номи мактаб ва ноҳия (портал барои як мактаб) */
export async function schoolBrand() {
  const schools = await db.school.findMany({ where: { isActive: true }, select: { name: true, district: true }, take: 2 });
  const s = schools.length === 1 ? schools[0] : null;
  return { name: s?.name ?? 'Портали маориф', sub: s ? `${s.district}, Портали муосири маориф` : 'Портали муосири маориф' };
}

export function Brand({ name, sub }: { name: string; sub: string }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3.5">
      <Logo className="h-12 w-12 sm:h-14 sm:w-14" />
      <span className="min-w-0 leading-tight">
        <b className="block truncate text-lg tracking-tight sm:text-2xl">{name}</b>
        <span className="hidden truncate text-[13.5px] text-slate-500 sm:block">{sub}</span>
      </span>
    </Link>
  );
}

/** Сарлавҳаи саҳифаҳои кушода (асосӣ, воридшавӣ, сабти ном) — мисли тасвири мактаб */
export async function PublicHeader({ active }: { active: string }) {
  const brand = await schoolBrand();
  return (
    <div className="print:hidden">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2.5 pt-4">
        <Brand {...brand} />
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <div className="glass flex items-center gap-2.5 rounded-2xl py-1.5 pl-1.5 pr-1.5 sm:pr-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-light text-brand"><Icon name="user" /></span>
            <span className="hidden text-[13.5px] leading-tight sm:block"><b className="block text-sm">Истифодабаранда</b><span className="text-slate-500">Ворид нашудаед</span></span>
          </div>
          <ThemeToggle initial={currentTheme()} />
        </div>
      </header>
      <nav className="mx-auto mt-1.5 max-w-6xl px-4" aria-label="Нақшҳо">
        <div className="glass flex gap-1.5 rounded-[20px] p-1.5">
          {NAV.map((n) => {
            const on = n.key === active;
            return (
              <Link key={n.key} href={n.href} title={n.label}
                className={`flex flex-1 basis-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-[15px] px-2 py-3 text-[15px] font-semibold transition ${
                  on ? 'flex-[2.2_1_0] bg-gradient-to-br from-[#2f86ff] to-[#1758e6] text-white shadow-[0_8px_24px_rgba(42,123,255,.45)] sm:flex-1'
                     : 'text-slate-500 hover:bg-brand/5 hover:text-ink dark:hover:bg-white/5'}`}>
                <Icon name={n.icon} className="h-[22px] w-[22px]" />
                <span className={on ? '' : 'hidden sm:inline'}>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
