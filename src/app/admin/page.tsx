import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { createSchool, setSchoolActive, createStaff, resetStaffPassword, setStaffActive } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

const ROLE = { DIRECTOR: 'Мудир', SPECIALIST: 'Мутахассис' } as Record<string, string>;

export default async function AdminHome() {
  const user = await requireRole(['DISTRICT_ADMIN']);
  const schools = await db.school.findMany({
    orderBy: { name: 'asc' },
    include: { users: { where: { role: { in: ['DIRECTOR', 'SPECIALIST'] } }, orderBy: [{ role: 'asc' }, { fullName: 'asc' }] } },
  });
  return (
    <PageShell user={user} title="Мактабҳо">
      <Section title="Мактаби нав">
        <ActionForm action={createSchool} submit="Сохтан" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">Номи мактаб<input name="name" className="input" placeholder="МТМУ №1" required /></label>
            <label className="label">Ноҳия<input name="district" className="input" required /></label>
          </div>
        </ActionForm>
      </Section>

      {schools.length === 0 ? <Section><Empty>Мактаб нест.</Empty></Section> : schools.map((s) => (
        <Section key={s.id} title={`${s.name} — ${s.district}${s.isActive ? '' : ' (ғайрифаъол)'}`}>
          <ul className="mb-4 divide-y divide-slate-100">
            {s.users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{ROLE[u.role]}: <b>{u.fullName}</b> <span className="font-mono text-sm text-slate-500">{u.login}</span>{!u.isActive && ' (ғайрифаъол)'}</span>
                <span className="flex gap-2">
                  <ActionForm action={resetStaffPassword} submit="Пароли нав" variant="small" confirm="Пароли нав сохта шавад?">
                    <input type="hidden" name="userId" value={u.id} />
                  </ActionForm>
                  <ActionForm action={setStaffActive} submit={u.isActive ? 'Ғайрифаъол' : 'Фаъол'} variant={u.isActive ? 'danger' : 'small'}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="active" value={u.isActive ? '0' : '1'} />
                  </ActionForm>
                </span>
              </li>
            ))}
          </ul>
          <div className="grid gap-4 lg:grid-cols-2">
            <ActionForm action={createStaff} submit="Илова" variant="small" resetOnSuccess className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="schoolId" value={s.id} />
              <select name="role" className="select"><option value="DIRECTOR">Мудир</option><option value="SPECIALIST">Мутахассис</option></select>
              <input name="fullName" placeholder="Ному насаб" className="input flex-1" required />
            </ActionForm>
            <ActionForm action={setSchoolActive} submit={s.isActive ? 'Ғайрифаъол кардани мактаб' : 'Фаъол кардани мактаб'} variant={s.isActive ? 'danger' : 'small'} confirm="Тасдиқ мекунед?">
              <input type="hidden" name="schoolId" value={s.id} />
              <input type="hidden" name="active" value={s.isActive ? '0' : '1'} />
            </ActionForm>
          </div>
        </Section>
      ))}
    </PageShell>
  );
}
