// Нормализатсияи номи синф ва номҳо.

const LAT_TO_CYR: Record<string, string> = { a: 'А', b: 'Б', v: 'В', g: 'Г', d: 'Д', e: 'Е', j: 'Ҷ' };

export type ClassName = { gradeLevel: number; letter: string; name: string };

/** "10a", "10-a", "10 а", "10А" → { 10, "А", "10-А" }. "5" → { 5, "", "5" }. Хато → null. */
export function normalizeClassName(input: string): ClassName | null {
  const s = input.trim().replace(/\s+/g, '').toUpperCase();
  const m = s.match(/^(\d{1,2})[-–.]?(\p{L})?$/u);
  if (!m) return null;
  const gradeLevel = Number(m[1]);
  if (gradeLevel < 1 || gradeLevel > 11) return null;
  let letter = m[2] ?? '';
  const cyr = LAT_TO_CYR[letter.toLowerCase()];
  if (cyr) letter = cyr;
  return { gradeLevel, letter, name: letter ? `${gradeLevel}-${letter}` : String(gradeLevel) };
}

/** Фосилаҳои зиёдатиро тоза мекунад. */
export function cleanName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}
