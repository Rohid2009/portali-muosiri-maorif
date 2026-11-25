// Ҳолати умумии формаҳо (server action → client)
export type Credential = { fullName: string; login: string; password: string; note?: string };

export type FormState = {
  error?: string;
  ok?: string;
  credentials?: Credential[];
  at?: number; // барои фарқ кардани ҷавобҳои пай дар пай
};

export const fail = (error: string): FormState => ({ error, at: Date.now() });
export const done = (ok: string, credentials?: Credential[]): FormState => ({ ok, credentials, at: Date.now() });

/** Хатои ZodError ё Error-ро ба паёми хоно табдил медиҳад */
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'issues' in e) return 'Маълумоти формаро дуруст пур кунед.';
  if (e instanceof Error) return e.message;
  return 'Хатои номаълум.';
}
