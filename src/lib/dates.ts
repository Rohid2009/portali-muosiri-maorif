// Санаҳо. Ҳама санаҳои дарс ҳамчун "YYYY-MM-DD" (вақти Тоҷикистон) коркард мешаванд.

export const SCHOOL_TZ = 'Asia/Dushanbe';

export const WEEKDAYS = ['', 'Душанбе', 'Сешанбе', 'Чоршанбе', 'Панҷшанбе', 'Ҷумъа', 'Шанбе', 'Якшанбе'];

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string): boolean {
  if (!ISO_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00.000Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Санаи имрӯза дар Тоҷикистон — сервер худаш муайян мекунад, на браузер. */
export function todayISO(now: Date = new Date(), tz: string = SCHOOL_TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** "YYYY-MM-DD" → Date барои сутуни @db.Date */
export function toDbDate(iso: string): Date {
  if (!isIsoDate(iso)) throw new Error(`Санаи нодуруст: ${iso}`);
  return new Date(iso + 'T00:00:00.000Z');
}

export function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 1 = душанбе … 7 = якшанбе */
export function weekdayOf(iso: string): number {
  const d = toDbDate(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

/** "2026-11-25" → "25.11.2026" */
export function formatTj(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
