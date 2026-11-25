import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, ROLE_HOME } from '@/lib/auth';
import { ActionForm } from '@/components/ActionForm';
import { ClassChooser, StudentCheckboxes, signupOptions } from '@/components/ChildPicker';
import { Icon } from '@/components/Icon';
import { registerParent } from '@/app/actions/parent';
import { PasswordInput } from '@/components/PasswordInput';
import { PublicHeader } from '@/components/PublicHeader';

export const dynamic = 'force-dynamic';

/** Сабти номи волид: мактаб → синф → фарзанд → ному насаб, телефон, парол */
export default async function RegisterPage({ searchParams }: { searchParams: { school?: string; class?: string } }) {
  const me = await getCurrentUser();
  if (me) redirect(ROLE_HOME[me.role]);

  const first = await signupOptions(Number(searchParams.school) || undefined);
  // Портал барои як мактаб: агар танҳо як мактаб бошад, интихоби мактаб лозим нест
  const single = first.schools.length === 1;
  const { schools, school, classes } = single && !first.school ? await signupOptions(first.schools[0].id) : first;
  const cls = classes.find((c) => c.id === Number(searchParams.class));
  const steps = single ? ['Синф', 'Фарзанд ва маълумот'] : ['Мактаб', 'Синф', 'Фарзанд ва маълумот'];
  const step = (single ? 0 : !school ? 1 : 0) || (!cls ? steps.length - 1 : steps.length);

  return (
    <>
    <PublicHeader active="parent" />
    <main className="px-4 pb-10 pt-6">
      <div className="mx-auto w-full max-w-[640px]">
        <Link href="/login?as=parent" className="btn-ghost mb-4"><Icon name="back" className="h-4 w-4" />Воридшавӣ</Link>
        <div className="card p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] text-white"><Icon name="family" /></span>
            <div>
              <h1 className="text-[22px] font-bold leading-tight">Сабти номи волид</h1>
              <p className="text-[13px] text-slate-500">{single && school ? `${school.name} · ` : ''}Қадами {step} аз {steps.length}</p>
            </div>
          </div>

          <ol className={`mb-6 grid gap-2 text-xs font-semibold ${steps.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {steps.map((t, i) => (
              <li key={t} className={`rounded-full px-3 py-1.5 text-center ${i + 1 < step ? 'bg-green-100 text-green-700' : i + 1 === step ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'}`}>{t}</li>
            ))}
          </ol>

          {schools.length === 0 ? (
            <p className="text-slate-500">Ҳоло ягон мактаб сабти номи мустақилро фаъол накардааст. Ба мутахассиси мактаб муроҷиат кунед.</p>
          ) : (
            <ClassChooser action="/register" schools={schools} schoolId={school?.id} classes={classes} classId={cls?.id} hideSchool={single} />
          )}

          {cls && (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <ActionForm action={registerParent} submit="Сабти ном ва фиристодани дархост" className="flex flex-col gap-4">
                <input type="hidden" name="classId" value={cls.id} />
                <StudentCheckboxes classId={cls.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="label sm:col-span-2">Ному насаби шумо<input name="fullName" className="input" autoComplete="name" required minLength={5} /></label>
                  <label className="label">Рақами телефон
                    <input name="phone" type="tel" inputMode="tel" className="input" placeholder="90 123 45 67" autoComplete="tel" required />
                  </label>
                  <label className="label">Шумо кӣ ҳастед
                    <select name="relation" className="select w-full"><option value="падар">Падар</option><option value="модар">Модар</option><option value="сарпараст">Сарпараст</option></select>
                  </label>
                  <label className="label">Парол<PasswordInput name="password" autoComplete="new-password" minLength={8} /></label>
                  <label className="label">Такрори парол<PasswordInput name="confirm" autoComplete="new-password" minLength={8} /></label>
                </div>
                <p className="rounded-xl bg-brand-light px-4 py-3 text-[13px] text-brand-dark">
                  Барои ҳифзи маълумоти кӯдакон дархости шумо ба мутахассиси мактаб меравад.
                  Пас аз тасдиқ шумо <b>танҳо фарзанди худро</b> мебинед: баҳоҳо, давомот ва одобу рафтор. Воридшавӣ — бо рақами телефон ва парол.
                </p>
              </ActionForm>
            </div>
          )}
        </div>
      </div>
    </main>
    </>
  );
}
