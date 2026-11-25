import Link from 'next/link';
import { requireSchoolUser, schoolContext, STAFF } from '@/lib/context';
import { PageShell, Section } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { updateSettings } from '@/app/actions/specialist';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireSchoolUser(STAFF);
  const { settings } = await schoolContext(user.schoolId);
  return (
    <PageShell user={user} title="Танзимот">
      <Section title="Амният ва баҳогузорӣ">
        <ActionForm action={updateSettings} submit="Сабт">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="parentMustChangePassword" defaultChecked={settings.parentMustChangePassword} />
            Волид дар воридшавии аввал паролро ҳатман иваз кунад
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowParentSignup" defaultChecked={settings.allowParentSignup} />
            Волидон худашон бо рақами телефон сабти ном карда метавонанд (фарзанд баъди тасдиқи мутахассис пайваст мешавад)
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="label">Кӯшишҳои хато то қуфл
              <input type="number" name="maxLoginAttempts" min={3} max={20} defaultValue={settings.maxLoginAttempts} className="input" />
            </label>
            <label className="label">Давомоти қуфл (дақиқа)
              <input type="number" name="lockMinutes" min={1} max={1440} defaultValue={settings.lockMinutes} className="input" />
            </label>
            <label className="label">Вазни имтиҳон дар баҳои солона (%)
              <input type="number" name="examWeightPercent" min={0} max={100} defaultValue={settings.examWeightPercent} className="input" />
            </label>
          </div>
          <p className="text-xs text-slate-500">0% — баҳои солона = миёнаи чорякҳо. 50% — (миёнаи чорякҳо + имтиҳон) ÷ 2.</p>
        </ActionForm>
      </Section>
      <Section title="Пароли ман">
        <Link href="/change-password" className="btn-ghost">Иваз кардани пароли худ</Link>
      </Section>
    </PageShell>
  );
}
