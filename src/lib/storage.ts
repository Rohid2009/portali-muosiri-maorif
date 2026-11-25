import 'server-only';
// Нигоҳдории файлҳо (ҳуҷҷатҳои «сабабнок») — берун аз база.
// Supabase Storage (REST). Агар тағйирёбандаҳо гузошта нашаванд, боркунии файл хомӯш аст.

const URL_ = process.env.STORAGE_URL;      // https://xxxx.supabase.co
const KEY = process.env.STORAGE_KEY;       // service_role key (танҳо дар сервер!)
const BUCKET = process.env.STORAGE_BUCKET; // масалан "excuses" (private bucket)

export const storageEnabled = Boolean(URL_ && KEY && BUCKET);

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export async function uploadFile(key: string, file: File): Promise<void> {
  if (!storageEnabled) throw new Error('Нигоҳдории файл танзим нашудааст');
  if (!ALLOWED.includes(file.type)) throw new Error('Танҳо JPG, PNG, WEBP ё PDF');
  if (file.size > MAX_FILE_BYTES) throw new Error('Файл набояд аз 2 МБ калон бошад');
  const res = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': file.type, 'x-upsert': 'false' },
    body: Buffer.from(await file.arrayBuffer()),
  });
  if (!res.ok) throw new Error('Файл бор карда нашуд');
}

/** Пайванди муваққатӣ (5 дақиқа) барои дидани файл */
export async function signedUrl(key: string): Promise<string | null> {
  if (!storageEnabled) return null;
  const res = await fetch(`${URL_}/storage/v1/object/sign/${BUCKET}/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 300 }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { signedURL?: string };
  return data.signedURL ? `${URL_}/storage/v1${data.signedURL}` : null;
}
