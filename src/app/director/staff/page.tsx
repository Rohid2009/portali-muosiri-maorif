import { db } from '@/lib/db';
import { requireSchoolUser } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { createStaff, setStaffActive } from '@/app/actions/admin';
import { CredentialsEditor } from '@/components/CredentialsEditor';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const user = await requireSchoolUser(['DIRECTOR']);
  const staff = await db.user.findMany({ where: { schoolId: user.schoolId, role: 'SPECIALIST' }, orderBy: { fullName: 'asc' } });
  return (
    <PageShell user={user} title="Мутахассисон">
      <Section title="Мутахассиси нав">
        <ActionForm action={createStaff} submit="Сохтан" resetOnSuccess>
          <input type="hidden" name="role" value="SPECIALIST" />
          <label className="label">Ному насаб<input name="fullName" className="input" required /></label>
        </ActionForm>
      </Section>
      <Section title="Рӯйхат">
        {staff.length === 0 ? <Empty>Мутахассис нест.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {staff.map((s) => (
              <li key={s.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{s.fullName}</b> <span className="font-mono text-sm text-slate-500">{s.login}</span>
                  {!s.isActive && <span className="badge ml-2 bg-slate-200">ғайрифаъол</span>}
                </span>
                <span className="flex gap-2">
                  <ActionForm action={setStaffActive} submit={s.isActive ? 'Ғайрифаъол' : 'Фаъол'} variant={s.isActive ? 'danger' : 'small'}>
                    <input type="hidden" name="userId" value={s.id} />
                    <input type="hidden" name="active" value={s.isActive ? '0' : '1'} />
                  </ActionForm>
                </span></div>
                <div className="mt-2"><CredentialsEditor userId={s.id} login={s.login} /></div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
