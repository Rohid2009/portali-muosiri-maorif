import 'server-only';
import { cookies } from 'next/headers';

/** Реҷаи ранг аз cookie; бо нобаёнӣ — торик (мисли тасвири мактаб) */
export function currentTheme(): 'dark' | 'light' {
  return cookies().get('theme')?.value === 'light' ? 'light' : 'dark';
}
