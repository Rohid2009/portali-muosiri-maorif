import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { ActionForm } from '@/components/ActionForm';
import { PasswordInput } from '@/components/PasswordInput';
import { PageShell, Section } from '@/components/PageShell';
import { changeLoginAction, updateMyContactAction } from '@/app/actions/auth';
import { db } from '@/lib/db';
import { formatPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

/** «Логин ва парол» — барои ҳар нақш; ҳар тағйир танҳо бо пароли ҳозира */
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  const contact = await db.user.findUnique({ where: { id: user.id }, select: { phone: true, phoneVisible: true } });

  return (
    <PageShell user={user} title="Логин ва парол" subtitle="Барои иваз кардан пароли ҳозираи худро ворид кунед.">
      {user.mustChangePassword && (
        <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Барои бехатарӣ пароли худро иваз кунед — баъд ба саҳифаи асосӣ мегузаред.
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Иваз кардани парол" icon="key">
          <ChangePasswordForm />
        </Section>

        {!user.mustChangePassword && (
          <Section title="Иваз кардани логин" icon="users">
            <p className="mb-4 text-sm text-slate-600">Логини ҳозира: <b className="font-mono">{user.login}</b></p>
            <ActionForm action={changeLoginAction} submit="Иваз кардани логин">
              <label className="label">Логини нав
                <input name="login" className="input font-mono" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} placeholder="масалан: gulnora.r" />
                <span className="text-xs font-normal text-slate-500">3–32 аломат: ҳарфҳои лотинӣ (a–z), рақам ва . _ -</span>
              </label>
              <label className="label">Пароли ҳозира
                <PasswordInput name="current" autoComplete="current-password" />
              </label>
            </ActionForm>
            {user.role === 'PARENT' && <p className="mt-3 text-[13px] text-slate-500">Бо рақами телефон низ ворид шуда метавонед.</p>}
          </Section>
        )}

        {!user.mustChangePassword && (user.role === 'TEACHER' || user.role === 'PARENT') && (
          <Section title="Рақами телефон дар рӯйхати тамос" icon="family">
            <ActionForm action={updateMyContactAction} submit="Сабт">
              <label className="label">Рақами телефон
                <input name="phone" type="tel" inputMode="tel" defaultValue={contact?.phone ? formatPhone(contact.phone) : ''} className="input" placeholder="90 123 45 67" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="visible" defaultChecked={contact?.phoneVisible ?? true} />
                Рақами маро ба {user.role === 'TEACHER' ? 'волидон' : 'омӯзгорон'} нишон диҳед
              </label>
              <p className="text-[13px] text-slate-500">Агар хомӯш кунед, номи шумо дар рӯйхат мемонад ва бо шумо дар чат навиштан мумкин аст, вале рақам пинҳон мешавад.</p>
            </ActionForm>
          </Section>
        )}
      </div>
    </PageShell>
  );
}
