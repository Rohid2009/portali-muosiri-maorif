// Алгоритми чоряк ва сол — функсияҳои пок (бе база), то санҷида шаванд.
import { quarterGrade, annualGrade } from './grades.ts';

export type QuarterRange = { number: number; start: string; end: string };
export type GradeRow = { date: string; grade: number | null };
export type AttendanceValue = 'PRESENT' | 'ABSENT' | 'EXCUSED';

/** Сана ба кадом чоряк тааллуқ дорад (аз рӯи санаҳои мутахассис). */
export function quarterOf(date: string, quarters: readonly QuarterRange[]): number | null {
  const q = quarters.find((x) => x.start <= date && date <= x.end);
  return q ? q.number : null;
}

export type PeriodResult = {
  quarters: (number | null)[]; // [Q1, Q2, Q3, Q4]; null = «бе баҳо»
  annual: number | null;
};

/** Баҳоҳои чорякӣ ва солона аз сатрҳои журнал. Санаҳои берун аз чорякҳо ҳисоб намешаванд. */
export function computePeriods(
  rows: readonly GradeRow[],
  quarters: readonly QuarterRange[],
  exam: number | null = null,
  examWeightPercent = 0,
): PeriodResult {
  const buckets: number[][] = [[], [], [], []];
  for (const r of rows) {
    if (r.grade === null) continue;
    const q = quarterOf(r.date, quarters);
    if (q && q >= 1 && q <= 4) buckets[q - 1].push(r.grade);
  }
  const qs = buckets.map((b) => quarterGrade(b));
  return { quarters: qs, annual: annualGrade(qs, exam, examWeightPercent) };
}

export type AttendanceStats = { present: number; absent: number; excused: number; total: number; percent: number | null };

/** Давомот: фоизи ҳузур (сабабнок ҳам ғоиб ҳисоб мешавад, вале алоҳида нишон дода мешавад). */
export function attendanceStats(values: readonly AttendanceValue[]): AttendanceStats {
  let present = 0, absent = 0, excused = 0;
  for (const v of values) {
    if (v === 'PRESENT') present++;
    else if (v === 'ABSENT') absent++;
    else excused++;
  }
  const total = present + absent + excused;
  return { present, absent, excused, total, percent: total ? Math.round((present / total) * 1000) / 10 : null };
}

/** Ҳисоби миёна барои ҳисоботҳо (бе округ ба бутун) */
export function average(nums: readonly number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}
