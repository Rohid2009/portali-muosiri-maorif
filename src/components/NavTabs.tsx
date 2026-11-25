'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Менюи капсула (шиша): бахши ҷорӣ — бо тугмаи кабуди дурахшон */
export function NavTabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  const active = items
    .filter((i) => path === i.href || path.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="mx-auto mt-1.5 max-w-6xl px-4" aria-label="Бахшҳо">
      <div className="glass flex gap-1 overflow-x-auto rounded-[20px] p-1.5 [scrollbar-width:none]">
        {items.map((n) => (
          <Link
            key={n.href + n.label}
            href={n.href}
            aria-current={n.href === active ? 'page' : undefined}
            className={`shrink-0 grow basis-auto whitespace-nowrap rounded-[15px] px-4 py-2.5 text-center text-sm font-semibold transition ${
              n.href === active
                ? 'bg-gradient-to-br from-[#2f86ff] to-[#1758e6] text-white shadow-[0_8px_24px_rgba(42,123,255,.4)]'
                : 'text-slate-500 hover:bg-brand/5 hover:text-ink dark:hover:bg-white/5'
            }`}
          >
            {n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
