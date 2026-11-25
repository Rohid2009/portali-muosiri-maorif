import Link from 'next/link';
import { logoutAction } from '@/app/actions/auth';
import type { CurrentUser } from '@/lib/auth';
import { currentTheme } from '@/lib/theme';
import { Icon } from './Icon';
import { Avatar } from './ui';
import { NavTabs } from './NavTabs';
import { ThemeToggle } from './ThemeToggle';
import { Brand } from './PublicHeader';

export const ROLE_LABEL: Record<CurrentUser['role'], string> = {
  DISTRICT_ADMIN: 'Админи ноҳия',
  DIRECTOR: 'Мудир',
  SPECIALIST: 'Мутахассис',
  TEACHER: 'Омӯзгор',
  PARENT: 'Волид',
};

/** Сарлавҳаи саҳифаҳои дохилӣ: логотип, корбар, калид, баромад, реҷа ва менюи капсула */
export function AppHeader({
  user, schoolName, schoolSub, nav = [],
}: { user: CurrentUser; schoolName?: string | null; schoolSub?: string | null; nav?: { href: string; label: string }[] }) {
  return (
    <div className="print:hidden">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-2.5 pt-4">
        <Brand name={schoolName ?? 'Портали маориф'} sub={schoolSub ?? 'Портали муосири маориф'} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="glass flex items-center gap-2.5 rounded-2xl py-1.5 pl-1.5 pr-1.5 md:pr-4">
            <Avatar name={user.fullName} size="md" />
            <span className="hidden text-[13.5px] leading-tight md:block">
              <b className="block max-w-[180px] truncate text-sm">{user.fullName}</b>
              <span className="text-slate-500">{ROLE_LABEL[user.role]}</span>
            </span>
          </div>
          <Link href="/change-password" title="Логин ва парол" aria-label="Логин ва парол" className="glass grid h-11 w-11 place-items-center rounded-full">
            <Icon name="key" />
          </Link>
          <form action={logoutAction}>
            <button type="submit" title="Баромад" aria-label="Баромад" className="glass grid h-11 w-11 place-items-center rounded-full">
              <Icon name="out" />
            </button>
          </form>
          <ThemeToggle initial={currentTheme()} />
        </div>
      </header>
      {nav.length > 0 && <NavTabs items={nav} />}
    </div>
  );
}
