import 'server-only';
import { db } from './db';
import { isoOf } from './dates';
import { annualGrade } from './grades';
import { computePeriods, type QuarterRange } from './periods';
import type { QuarterInfo } from './context';

export type PeriodRow = { quarters: (number | null)[]; exam: number | null; annual: number | null };

/**
 * Баҳоҳои чорякӣ/солона барои ҷуфтҳои (хонанда, фан).
 * Чоряки баста — аз snapshot (PeriodGrade); кушода — ҳисоби зинда аз журнал.
 */
export async function periodTable(opts: {
  academicYearId: number;
  quarters: QuarterInfo[];
  examWeightPercent: number;
  studentIds: number[];
  subjectIds?: number[];
}): Promise<Map<string, PeriodRow>> {
  const { academicYearId, quarters, studentIds, subjectIds } = opts;
  const out = new Map<string, PeriodRow>();
  if (!studentIds.length) return out;
  const ranges: QuarterRange[] = quarters.map((q) => ({ number: q.number, start: q.start, end: q.end }));
  const [entries, snaps] = await Promise.all([
    db.journalEntry.findMany({
      where: { studentId: { in: studentIds }, ...(subjectIds ? { subjectId: { in: subjectIds } } : {}), class: { academicYearId }, grade: { not: null } },
      select: { studentId: true, subjectId: true, grade: true, lessonDate: true },
    }),
    db.periodGrade.findMany({
      where: { academicYearId, studentId: { in: studentIds }, ...(subjectIds ? { subjectId: { in: subjectIds } } : {}) },
    }),
  ]);
  const rows = new Map<string, { date: string; grade: number | null }[]>();
  for (const e of entries) {
    const k = `${e.studentId}:${e.subjectId}`;
    const arr = rows.get(k) ?? ([] as { date: string; grade: number | null }[]);
    arr.push({ date: isoOf(e.lessonDate), grade: e.grade });
    rows.set(k, arr);
  }
  const snap = new Map<string, Map<string, number | null>>();
  for (const s of snaps) {
    const k = `${s.studentId}:${s.subjectId}`;
    const m = snap.get(k) ?? new Map<string, number | null>();
    m.set(s.kind, s.value);
    snap.set(k, m);
  }
  const keys = new Set([...rows.keys(), ...snap.keys()]);
  for (const k of keys) {
    const s = snap.get(k);
    const exam = s?.get('EXAM') ?? null;
    const live = computePeriods(rows.get(k) ?? [], ranges, exam, opts.examWeightPercent);
    const qs = [1, 2, 3, 4].map((n, i) => {
      const q = quarters.find((x) => x.number === n);
      if (q?.closed) return s?.get(`Q${n}`) ?? null;
      return live.quarters[i];
    });
    const annual = s?.has('ANNUAL') ? (s.get('ANNUAL') ?? null) : annualGrade(qs, exam, opts.examWeightPercent);
    out.set(k, { quarters: qs, exam, annual });
  }
  return out;
}

export function fmtGrade(v: number | null | undefined): string {
  return v === null || v === undefined ? 'бе баҳо' : String(v);
}
