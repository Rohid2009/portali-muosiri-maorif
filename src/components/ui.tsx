import Link from 'next/link';
import { Icon, type IconName } from './Icon';

/** Синфи ранги баҳо: 9–10 сабз, 7–8 кабуд, 5–6 зард, ≤ 4 сурх */
export function gradeClass(g: number): string {
  if (g >= 9) return 'grade-9';
  if (g >= 7) return 'grade-7';
  if (g >= 5) return 'grade-5';
  return 'grade-3';
}

/** Баҳо ҳамчун «чип»-и ранга; null → «бе баҳо» */
export function GradeChip({ value, strong = false, empty = 'бе баҳо' }: { value: number | null | undefined; strong?: boolean; empty?: string }) {
  if (value === null || value === undefined) return <span className="text-xs text-slate-400">{empty}</span>;
  return <span className={`grade ${gradeClass(value)} ${strong ? 'ring-2 ring-inset ring-current' : ''}`}>{value}</span>;
}

/** Аломати давомот: «н» нест, «с» сабабнок */
export function AttendanceMark({ value }: { value: 'PRESENT' | 'ABSENT' | 'EXCUSED' }) {
  if (value === 'ABSENT') return <span className="pill pill-red">н</span>;
  if (value === 'EXCUSED') return <span className="pill pill-amber">с</span>;
  return <span className="text-slate-400">·</span>;
}

const TONE = {
  blue: 'bg-brand-light text-brand',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  gold: 'bg-amber-50 text-amber-600',
} as const;

export function StatCard({
  icon, tone = 'blue', value, label, href, alert,
}: { icon: IconName; tone?: keyof typeof TONE; value: React.ReactNode; label: string; href?: string; alert?: boolean }) {
  const body = (
    <div className={`stat ${alert ? 'ring-2 ring-gold' : ''}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TONE[tone]}`}><Icon name={icon} /></span>
      <div className="min-w-0">
        <div className="text-2xl font-bold tabular-nums leading-tight sm:text-[28px]">{value}</div>
        <div className="truncate text-[13px] text-slate-500">{label}</div>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** Ҳарфҳои аввали ном дар доира */
export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const ini = name.split(' ').slice(0, 2).map((w) => w[0]).join('');
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-bold ${size === 'md' ? 'h-9 w-9 bg-gold text-sm text-amber-950' : 'h-8 w-8 bg-brand-light text-xs text-brand'}`}>
      {ini}
    </span>
  );
}

/** Хати пешрафт (0–100) */
export function Bar({ percent, className = 'bg-brand', thin = false }: { percent: number; className?: string; thin?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-full bg-slate-100 ${thin ? 'h-1.5' : 'h-2'}`}>
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}

/** Интихоби уфуқӣ (чоряк ва ғ.) */
export function Segmented({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="seg print:hidden">
      {items.map((i) => (
        <Link key={i.href + i.label} href={i.href} className={i.active ? 'seg-on' : ''}>{i.label}</Link>
      ))}
    </div>
  );
}

export function barColor(g: number | null): string {
  if (g === null) return 'bg-slate-200';
  if (g >= 9) return 'bg-green-600';
  if (g >= 7) return 'bg-blue-600';
  if (g >= 5) return 'bg-amber-500';
  return 'bg-red-600';
}
