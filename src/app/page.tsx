import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, ROLE_HOME } from '@/lib/auth';
import { Icon, ShieldCheck, type IconName } from '@/components/Icon';
import { HeroArt } from '@/components/HeroArt';
import { PublicHeader } from '@/components/PublicHeader';

export const dynamic = 'force-dynamic';

const ROLES: { portal: string; icon: IconName; label: string; hint: string; color: string }[] = [
  { portal: 'teacher', icon: 'book', label: 'Барои омӯзгорон', hint: 'Журнал, баҳо ва давомот', color: 'from-[#3b82f6] to-[#1d4ed8]' },
  { portal: 'parent', icon: 'family', label: 'Барои волидон', hint: 'Ворид ё сабти ном бо рақами телефон', color: 'from-[#8b5cf6] to-[#6d28d9]' },
  { portal: 'staff', icon: 'case', label: 'Мутахассис', hint: 'Идораи мактаб · мудир низ аз ин ҷо', color: 'from-[#22c55e] to-[#15803d]' },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? '/change-password' : ROLE_HOME[user.role]);

  return (
    <>
      <PublicHeader active="home" />
      <main className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-2 pt-7 lg:grid-cols-2">
        <section>
          <h1 className="text-[clamp(30px,4.3vw,54px)] font-extrabold leading-[1.06] tracking-[-0.025em]">
            <span className="whitespace-nowrap">Журнали электронии</span>
            <br />
            <span className="bg-gradient-to-r from-[#0b6fd6] to-[#0b4f8a] bg-clip-text text-transparent dark:from-[#22c4ff] dark:to-[#3b8bff]">мактаб</span>
          </h1>
          <p className="mt-4 max-w-[32em] text-[clamp(16px,1.6vw,19px)] text-slate-600 dark:text-[#c8d6f0]">
            Баҳо, давомот ва одобу рафтор — дар як ҷо, барои омӯзгор, волид ва роҳбарияти мактаб.
          </p>
          <div className="my-6 h-[5px] w-[110px] rounded-full bg-gradient-to-r from-[#22c4ff] via-[#2a7bff] to-[#2a7bff]/20" />
          <nav className="flex max-w-[560px] flex-col gap-3.5" aria-label="Интихоби нақш">
            {ROLES.map((r) => (
              <Link
                key={r.portal}
                href={`/login?as=${r.portal}`}
                className="group flex items-center gap-4 rounded-[20px] border border-white/70 bg-gradient-to-br from-white/95 to-[#e4ecff]/90 px-4 py-4 text-[#0f1b2d] shadow-[0_10px_30px_rgba(3,12,40,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(3,12,40,.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400 dark:shadow-[0_10px_30px_rgba(3,12,40,.45)]"
              >
                <span className={`grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full bg-gradient-to-br text-white ${r.color}`}><Icon name={r.icon} className="h-[26px] w-[26px]" /></span>
                <span className="min-w-0">
                  <span className="block text-lg font-bold">{r.label}</span>
                  <span className="block text-sm text-[#46546b]">{r.hint}</span>
                </span>
                <span className={`ml-auto grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-gradient-to-br text-white transition group-hover:translate-x-0.5 ${r.color}`}><Icon name="arrow" className="h-[18px] w-[18px]" /></span>
              </Link>
            ))}
          </nav>
        </section>
        <section className="order-first mx-auto w-full max-w-[420px] lg:order-none lg:max-w-[560px]"><HeroArt /></section>
      </main>
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-6">
        <div className="glass flex flex-wrap items-center gap-4 rounded-[20px] px-5 py-4 sm:flex-nowrap">
          <ShieldCheck />
          <p className="max-w-[36em] text-[14.5px] text-slate-600 dark:text-[#c8d6f0]">
            Портали муосири маориф бо мақсади беҳтар намудани хизматрасонӣ ва шаффофият дар соҳаи маориф.
          </p>
          <span className="ml-auto hidden w-px self-stretch bg-brand/15 sm:block dark:bg-white/15" />
          <span className="w-full text-center font-script text-[clamp(22px,2.6vw,30px)] text-[#0b6fd6] sm:w-auto dark:text-[#3fc6ff] dark:[text-shadow:0_0_18px_rgba(63,198,255,.35)]">
            Маориф — калиди оянда!
          </span>
        </div>
        <p className="mt-4 text-center text-[13px] text-slate-500">Паролро фаромӯш кардед? Ба мутахассиси мактаб муроҷиат кунед.</p>
      </div>
    </>
  );
}
