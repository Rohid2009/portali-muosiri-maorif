'use client';

import { useState } from 'react';

/** Майдони парол бо тугмаи «нишон додан / пинҳон кардан» */
export function PasswordInput({
  name, autoComplete = 'current-password', required = true, minLength, placeholder, id,
}: { name: string; autoComplete?: string; required?: boolean; minLength?: number; placeholder?: string; id?: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        className="input pr-12"
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[10px] text-slate-500 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40"
        aria-label={show ? 'Пинҳон кардани парол' : 'Нишон додани парол'}
        aria-pressed={show}
        title={show ? 'Пинҳон кардан' : 'Нишон додан'}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {show ? (
            <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          ) : (
            <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>
          )}
        </svg>
      </button>
    </span>
  );
}
