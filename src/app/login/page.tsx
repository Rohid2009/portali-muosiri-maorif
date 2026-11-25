import Link from 'next/link';
import { LoginForm } from '@/components/LoginForm';
import { Icon, type IconName } from '@/components/Icon';
import { PublicHeader } from '@/components/PublicHeader';

const PORTALS: Record<string, { title: string; icon: IconName }> = {
  teacher: { title: 'Воридшавии омӯзгор', icon: 'book' },
  parent: { title: 'Воридшавии волид', icon: 'family' },
  staff: { title: 'Мутахассис ё мудир', icon: 'clip' },
};

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: { as?: string; r?: string } }) {
  const portal = searchParams.as && Object.hasOwn(PORTALS, searchParams.as) ? searchParams.as : 'teacher';
  const p = PORTALS[portal];

  const active = portal === 'staff' ? (searchParams.r === 'director' ? 'director' : 'staff') : portal;
  return (
    <>
    <PublicHeader active={active} />
    <main className="grid place-items-center px-4 pb-10 pt-6">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="btn-ghost mb-4"><Icon name="back" className="h-4 w-4" />Бозгашт</Link>
        <div className="card p-6 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white"><Icon name={p.icon} /></span>
            <h1 className="text-[22px] font-bold">{p.title}</h1>
          </div>
          <LoginForm portal={portal} />
          {portal === 'staff' && <p className="mt-4 text-center text-[13px] text-slate-500">Мудир ва админи ноҳия ҳам аз ҳамин ҷо ворид мешаванд.</p>}
          {portal === 'parent' && (
            <div className="mt-5 border-t border-slate-100 pt-5 text-center">
              <p className="mb-3 text-sm text-slate-600">Ҳисоб надоред?</p>
              <Link href="/register" className="btn-ghost w-full"><Icon name="plus" className="h-4 w-4" />Сабти ном бо рақами телефон</Link>
            </div>
          )}
        </div>
        <p className="text-center text-[13px] text-slate-500">Паролро фаромӯш кардед? Ба мутахассиси мактаб муроҷиат кунед.</p>
      </div>
    </main>
    </>
  );
}
