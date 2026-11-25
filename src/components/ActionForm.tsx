'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/form';

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Submit({ label, variant }: { label: string; variant: 'primary' | 'small' | 'danger' }) {
  const { pending } = useFormStatus();
  const cls =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'danger'
        ? 'btn-small bg-red-600 hover:bg-red-700'
        : 'btn-small';
  return (
    <button type="submit" className={cls} disabled={pending}>
      {pending ? '…' : label}
    </button>
  );
}

/** Форма барои ҳар server action: паёми хато/муваффақият ва варақаи логину парол. */
export function ActionForm({
  action,
  children,
  submit = 'Сабт',
  variant = 'primary',
  className = 'flex flex-col gap-3',
  resetOnSuccess = false,
  confirm,
}: {
  action: Action;
  children?: React.ReactNode;
  submit?: string;
  variant?: 'primary' | 'small' | 'danger';
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction] = useFormState<FormState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state.at, state.ok, resetOnSuccess]);

  return (
    <div>
      <form
        ref={ref}
        action={formAction}
        className={className}
        onSubmit={(e) => {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
        }}
      >
        {children}
        <Submit label={submit} variant={variant} />
      </form>
      {state.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}
      {state.ok && <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" role="status">{state.ok}</p>}
      {state.credentials && state.credentials.length > 0 && <CredentialSlip items={state.credentials} />}
    </div>
  );
}

function CredentialSlip({ items }: { items: NonNullable<FormState['credentials']> }) {
  return (
    <div className="print-area mt-3 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 p-4">
      <p className="mb-2 text-sm font-semibold text-amber-900 print:hidden">
        ⚠️ Паролҳо танҳо ҳозир нишон дода мешаванд. Чоп кунед ё нависед.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="py-1 pr-2">Ному насаб</th>
            <th className="py-1 pr-2">Логин</th>
            <th className="py-1">Парол</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.login} className="border-t border-amber-200 align-top">
              <td className="py-1 pr-2">
                {c.fullName}
                {c.note && <div className="text-xs text-slate-600">{c.note}</div>}
              </td>
              <td className="py-1 pr-2 font-mono">{c.login}</td>
              <td className="py-1 font-mono">{c.password}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => window.print()} className="btn-small mt-3 print:hidden">
        🖨 Чоп кардан
      </button>
    </div>
  );
}
