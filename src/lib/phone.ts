// Рақами телефони Тоҷикистон → "992XXXXXXXXX" ё null.
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9) d = '992' + d;
  return /^992\d{9}$/.test(d) ? d : null;
}

/** "992901234567" → "+992 90 123 4567" */
export function formatPhone(p: string): string {
  return p.length === 12 ? `+${p.slice(0, 3)} ${p.slice(3, 5)} ${p.slice(5, 8)} ${p.slice(8)}` : p;
}

/**
 * Номи кӯтоҳи хонанда барои рӯйхати оммавӣ: "Боқиева Мадина Ҷамшедовна" → "Мадина Б."
 * Ному насаби пурра ба бегонагон нишон дода намешавад.
 */
export function shortStudentName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ? `${parts[0][0]}.` : '';
  return `${parts[1]} ${parts[0][0]}.`;
}
