'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { changePasswordAction, type FormState } from '@/app/actions/auth';
import { PasswordInput } from './PasswordInput';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Сабт…' : 'Иваз кардани парол'}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useFormState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="label">Пароли ҳозира
        <PasswordInput name="current" autoComplete="current-password" />
      </label>
      <label className="label">Пароли нав
        <PasswordInput name="next" autoComplete="new-password" minLength={8} />
        <span className="text-xs font-normal text-slate-500">Камаш 8 аломат, ҳам ҳарф ва ҳам рақам.</span>
      </label>
      <label className="label">Такрори пароли нав
        <PasswordInput name="confirm" autoComplete="new-password" minLength={8} />
      </label>
      {state.error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{state.error}</p>}
      {state.ok && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800" role="status">{state.ok}</p>}
      <Submit />
    </form>
  );
}
