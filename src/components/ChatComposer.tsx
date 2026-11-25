'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { sendMessage } from '@/app/actions/chat';
import type { FormState } from '@/lib/form';

function Send() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label="Фиристодан"
      className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white hover:bg-brand-dark disabled:opacity-50">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12 20 4l-6 16-3-7z" /></svg>
    </button>
  );
}

/** Майдони навиштани паём: Enter — фиристодан, Shift+Enter — сатри нав */
export function ChatComposer({ conversationId, disabled }: { conversationId: number; disabled?: boolean }) {
  const [state, action] = useFormState<FormState, FormData>(sendMessage, {});
  const form = useRef<HTMLFormElement>(null);
  // Вақти кушодани саҳифа — сервер паёмеро, ки «фавран» аз скрипт меояд, рад мекунад
  const [openedAt, setOpenedAt] = useState(0);
  useEffect(() => { setOpenedAt(Date.now()); }, []);
  useEffect(() => {
    if (state.ok !== undefined && !state.error) form.current?.reset();
  }, [state.at, state.ok, state.error]);

  if (disabled) return <p className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm text-slate-500">Ин ҳисоб ғайрифаъол аст — навиштан мумкин нест.</p>;
  return (
    <div>
      <form ref={form} action={action} className="relative flex items-end gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <input type="hidden" name="openedAt" value={openedAt} />
        {/* Дом барои ботҳо — барои одам ноаён */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-px w-px opacity-0" defaultValue="" />
        <textarea
          name="body" rows={1} maxLength={2000} required placeholder="Паём нависед…"
          className="input max-h-40 min-h-[48px] flex-1 resize-y rounded-2xl"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.current?.requestSubmit(); }
          }}
        />
        <Send />
      </form>
      {state.error && <p className="mt-2 text-sm text-red-700" role="alert">{state.error}</p>}
    </div>
  );
}
