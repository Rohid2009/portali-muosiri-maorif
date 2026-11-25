export const ATT_LABEL: Record<string, string> = { PRESENT: 'Ҳаст', ABSENT: 'Нест', EXCUSED: 'Сабабнок' };
export const ATT_SHORT: Record<string, string> = { PRESENT: '', ABSENT: 'н', EXCUSED: 'с' };
export const BEH_LABEL: Record<string, string> = {
  EXEMPLARY: 'Намунавӣ',
  SATISFACTORY: 'Қаноатбахш',
  UNSATISFACTORY: 'Ғайриқаноатбахш',
};

type V = { grade?: number | null; attendance?: string; behavior?: string | null };

/** {grade, attendance, behavior} → «8 · Ҳаст · Намунавӣ». Қабул мекунад JSON аз база ҳам. */
export function describeValue(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '—';
  const v = raw as V;
  return [v.grade ?? '—', v.attendance ? ATT_LABEL[v.attendance] : '', v.behavior ? BEH_LABEL[v.behavior] : '']
    .filter(Boolean)
    .join(' · ');
}
