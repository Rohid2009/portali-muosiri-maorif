import { db } from '@/lib/db';
import { requireSchoolUser, STAFF } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { addSubjects, renameSubject, deleteSubject } from '@/app/actions/specialist';

export const dynamic = 'force-dynamic';

export default async function SubjectsPage() {
  const user = await requireSchoolUser(STAFF);
  const subjects = await db.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: 'asc' } });
  return (
    <PageShell user={user} title="Фанҳо">
      <Section title="Илова кардан">
        <ActionForm action={addSubjects} submit="Илова" resetOnSuccess>
          <label className="label">
            Ҳар фан дар сатри алоҳида
            <textarea name="names" rows={5} className="input" placeholder={'Математика\nЗабони тоҷикӣ\nТаърихи халқи тоҷик'} required />
          </label>
        </ActionForm>
      </Section>
      <Section title={`Рӯйхат (${subjects.length})`}>
        {subjects.length === 0 ? <Empty>Ҳанӯз фан нест.</Empty> : (
          <ul className="divide-y divide-slate-100">
            {subjects.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <ActionForm action={renameSubject} submit="Сабт" variant="small" className="flex gap-2">
                    <input type="hidden" name="subjectId" value={s.id} />
                    <input name="name" defaultValue={s.name} className="input" required aria-label="Номи фан" />
                  </ActionForm>
                </div>
                <ActionForm action={deleteSubject} submit="Нест" variant="danger" confirm={`«${s.name}»-ро нест мекунед? Тақсимот ва ҷадвали ин фан ҳам гирифта мешаванд. Агар баҳо дошта бошад, нест намешавад.`}>
                  <input type="hidden" name="subjectId" value={s.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
