import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { PageShell, Section } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { ClassChooser, StudentCheckboxes, signupOptions } from '@/components/ChildPicker';
import { requestChildren } from '@/app/actions/parent';

export const dynamic = 'force-dynamic';

/** Волид фарзанди дигарашро (масалан дар синфи дигар) илова мекунад */
export default async function AddChildPage({ searchParams }: { searchParams: { school?: string; class?: string } }) {
  const user = await requireRole(['PARENT']);
  const own = user.schoolId ? await db.school.findUnique({ where: { id: user.schoolId }, select: { id: true } }) : null;
  const { schools, school, classes } = await signupOptions(Number(searchParams.school) || own?.id);
  const cls = classes.find((c) => c.id === Number(searchParams.class));

  return (
    <PageShell user={user} title="Иловаи фарзанд" subtitle="Дархост ба мутахассиси мактаб меравад; баъди тасдиқ фарзанд дар рӯйхати шумо пайдо мешавад.">
      <Section title={schools.length === 1 ? 'Синф' : 'Мактаб ва синф'} icon="book">
        <ClassChooser action="/parent/add" schools={schools} schoolId={school?.id} classes={classes} classId={cls?.id} hideSchool={schools.length === 1} />
      </Section>
      {cls && (
        <Section title={`Синфи ${cls.name}`} icon="family">
          <ActionForm action={requestChildren} submit="Фиристодани дархост">
            <input type="hidden" name="classId" value={cls.id} />
            <StudentCheckboxes classId={cls.id} />
            <label className="label max-w-xs">Шумо кӣ ҳастед
              <select name="relation" className="select w-full"><option value="падар">Падар</option><option value="модар">Модар</option><option value="сарпараст">Сарпараст</option></select>
            </label>
          </ActionForm>
        </Section>
      )}
    </PageShell>
  );
}
