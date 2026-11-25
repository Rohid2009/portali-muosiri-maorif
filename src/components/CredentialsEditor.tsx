import { ActionForm } from './ActionForm';
import { PasswordInput } from './PasswordInput';
import { setUserCredentials } from '@/app/actions/specialist';

/**
 * Иваз кардани логин ва/ё пароли корбари дигар (мутахассис → омӯзгор/волид, мудир → мутахассис).
 * Пароли пешина лозим нест.
 */
export function CredentialsEditor({ userId, login, label = 'Логин ва парол' }: { userId: number; login: string; label?: string }) {
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-brand">{label}</summary>
      <div className="mt-3">
        <ActionForm action={setUserCredentials} submit="Сабт кардан" variant="small">
          <input type="hidden" name="userId" value={userId} />
          <label className="label">Логин
            <input name="login" defaultValue={login} className="input font-mono" autoCapitalize="none" spellCheck={false} />
          </label>
          <fieldset className="space-y-1.5 text-sm">
            <legend className="mb-1 font-semibold">Парол</legend>
            <label className="flex items-center gap-2"><input type="radio" name="pwdMode" value="keep" defaultChecked /> Бетағйир</label>
            <label className="flex items-center gap-2"><input type="radio" name="pwdMode" value="random" /> Пароли тасодуфии нав созед</label>
            <label className="flex items-center gap-2"><input type="radio" name="pwdMode" value="manual" /> Паролро худам менависам:</label>
          </fieldset>
          <PasswordInput name="password" autoComplete="new-password" required={false} placeholder="камаш 8 аломат, ҳарф ва рақам" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mustChange" defaultChecked /> Дар воридшавии навбатӣ паролро иваз кунад
          </label>
          <p className="text-xs text-slate-500">Пароли пешина лозим нест. Корбар аз ҳамаи дастгоҳҳо хориҷ мешавад.</p>
        </ActionForm>
      </div>
    </details>
  );
}
