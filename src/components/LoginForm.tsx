'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { loginAction, type FormState } from '@/app/actions/auth';
import { PasswordInput } from './PasswordInput';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Санҷиш…' : 'Ворид шудан'}
    </button>
  );
}

export function LoginForm({ portal }: { portal: string }) {
  const [state, action] = useFormState<FormState, FormData>(loginAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="portal" value={portal} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">{portal === 'parent' ? 'Рақами телефон ё логин' : 'Логин'}</span>
        <input name="login" className="input" autoComplete="username" autoCapitalize="none" inputMode={portal === 'parent' ? 'tel' : undefined} placeholder={portal === 'parent' ? '90 123 45 67' : undefined} required />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Парол</span>
        <PasswordInput name="password" autoComplete="current-password" />
      </label>
      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{state.error}</p>
      )}
      <Submit />
    </form>
  );
}
