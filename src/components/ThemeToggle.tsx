'use client';

import { useEffect, useState } from 'react';

/** Тугмаи реҷаи торик/равшан. Интихоб дар cookie нигоҳ дошта мешавад (сервер онро медонад — бе «дурахш»). */
export function ThemeToggle({ initial }: { initial: 'dark' | 'light' }) {
  const [theme, setTheme] = useState(initial);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className="glass grid h-12 w-12 shrink-0 place-items-center rounded-full"
      aria-label={dark ? 'Реҷаи равшан' : 'Реҷаи торик'}
      title={dark ? 'Реҷаи равшан' : 'Реҷаи торик'}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] text-amber-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] text-sky-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" /></svg>
      )}
    </button>
  );
}
