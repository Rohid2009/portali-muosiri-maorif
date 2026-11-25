// Ҳисоби баҳоҳо. Қоидаи округ ДАР ЯК ҶО — ҳамаи коди дигар танҳо инро истифода мебарад.

/**
 * Қоидаи ягонаи округ: касри < 0.5 → поён, ≥ 0.5 → боло.
 * 6.4 → 6, 6.5 → 7, 6.75 → 7.
 * Барои пешгирии хатои float (масалан 6.4999999) аввал то 2 рақами касрӣ округ мекунем.
 */
export function roundGrade(value: number): number {
  if (!Number.isFinite(value)) throw new Error('roundGrade: қимати нодуруст');
  const fixed = Math.round(value * 100) / 100;
  const whole = Math.floor(fixed);
  return fixed - whole >= 0.5 ? whole + 1 : whole;
}

/**
 * Баҳои чорякӣ = ҷамъ ÷ шумора, бо roundGrade.
 * Агар баҳо набошад → null («бе баҳо»), тақсим ба сифр намешавад.
 */
export function quarterGrade(grades: readonly number[]): number | null {
  const valid = grades.filter((g) => Number.isInteger(g) && g >= 1 && g <= 10);
  if (valid.length === 0) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return roundGrade(sum / valid.length);
}

/**
 * Баҳои солона аз баҳоҳои чорякӣ (null-ҳо — «бе баҳо» — ҳисоб намешаванд).
 * examWeightPercent: 0 = имтиҳон ҳисоб намешавад; 50 = (миёнаи чорякҳо + имтиҳон) / 2.
 */
export function annualGrade(
  quarters: readonly (number | null)[],
  exam: number | null = null,
  examWeightPercent = 0,
): number | null {
  const q = quarters.filter((x): x is number => x !== null);
  if (q.length === 0) return exam !== null && examWeightPercent > 0 ? exam : null;
  const avg = q.reduce((a, b) => a + b, 0) / q.length;
  if (exam === null || examWeightPercent <= 0) return roundGrade(avg);
  const w = Math.min(Math.max(examWeightPercent, 0), 100) / 100;
  return roundGrade(avg * (1 - w) + exam * w);
}
