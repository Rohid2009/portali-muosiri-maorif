import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext, STAFF } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { CredentialsEditor } from '@/components/CredentialsEditor';
import { ActionForm } from '@/components/ActionForm';
import {
  createStudent, createStudentsBulk, updateStudent, linkParent, newParentAccount,
  deleteStudent, unlinkParent,
} from '@/app/actions/specialist';

export const dynamic = 'force-dynamic';
// Сохтани паролҳо (bcrypt) ва гузариши сол вақт мегирад
export const maxDuration = 60;

const STATUS: Record<string, string> = {
  ACTIVE: 'Мехонад',
  ABROAD: 'Муваққатан дар хориҷа',
  EXPELLED: 'Хориҷ шуд',
  GRADUATED: 'Хатм кард',
};

export default async function StudentsPage({ searchParams }: { searchParams: { classId?: string; q?: string } }) {
  const user = await requireSchoolUser(STAFF);
  const ctx = await schoolContext(user.schoolId);
  if (!ctx.year) {
    return (
      <PageShell user={user} title="Хонандагон">
        <Section><Empty>Аввал соли таҳсил ва синфҳоро созед.</Empty></Section>
      </PageShell>
    );
  }
  const classes = await db.class.findMany({ where: { academicYearId: ctx.year.id }, orderBy: [{ gradeLevel: 'asc' }, { letter: 'asc' }] });
  const classId = Number(searchParams.classId) || classes[0]?.id;
  const cls = classes.find((c) => c.id === classId);
  const q = (searchParams.q ?? '').trim();

  const enrollments = q
    ? await db.classEnrollment.findMany({
        where: { academicYearId: ctx.year.id, schoolId: user.schoolId, student: { fullName: { contains: q, mode: 'insensitive' } } },
        include: { class: true, student: { include: { parents: { include: { parent: true } } } } },
        take: 50,
      })
    : cls
      ? await db.classEnrollment.findMany({
          where: { classId: cls.id },
          include: { class: true, student: { include: { parents: { include: { parent: true } } } } },
          orderBy: { student: { fullName: 'asc' } },
        })
      : [];

  return (
    <PageShell user={user} title="Хонандагон">
      <Section>
        <div className="flex flex-wrap gap-2">
          {classes.map((c) => (
            <Link key={c.id} href={`/specialist/students?classId=${c.id}`} className={c.id === classId && !q ? 'btn-small' : 'btn-ghost'}>{c.name}</Link>
          ))}
        </div>
        <form className="mt-3 flex gap-2" action="/specialist/students">
          <input name="q" defaultValue={q} placeholder="Ҷустуҷӯ аз рӯи ном…" className="input" />
          <button className="btn-small" type="submit">Ҷустуҷӯ</button>
        </form>
      </Section>

      {cls && !q && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title={`Иловаи хонанда ба ${cls.name}`}>
            <ActionForm action={createStudent} submit="Илова" resetOnSuccess>
              <input type="hidden" name="classId" value={cls.id} />
              <label className="label">Ному насаби хонанда<input name="fullName" className="input" required /></label>
              <label className="label">Ҷинс
                <select name="gender" className="select"><option value="">—</option><option value="M">Писар</option><option value="F">Духтар</option></select>
              </label>
              <label className="label">Ному насаби волид (ихтиёрӣ)<input name="parentName" className="input" /></label>
              <label className="label">
                Ё логини волиди мавҷуда (агар фарзанди дигараш ҳам мехонад)
                <input name="parentLogin" className="input font-mono" placeholder="p12-0001" autoCapitalize="none" />
              </label>
            </ActionForm>
          </Section>
          <Section title="Иловаи якбора">
            <ActionForm action={createStudentsBulk} submit="Илова ва чопи паролҳо" resetOnSuccess>
              <input type="hidden" name="classId" value={cls.id} />
              <label className="label">
                Ҳар хонанда дар сатри алоҳида (то 25). Барои ҳар кас ҳисоби волид сохта мешавад.
                <textarea name="names" rows={7} className="input" required />
              </label>
            </ActionForm>
          </Section>
        </div>
      )}

      <Section title={q ? `Натиҷаи ҷустуҷӯ: «${q}»` : `${cls?.name ?? ''} — ${enrollments.length} хонанда`}>
        {enrollments.length === 0 ? <Empty>Хонанда нест.</Empty> : (
          <div className="space-y-3">
            {enrollments.map((e, i) => (
              <details key={e.id} className="rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer">
                  <span className="text-slate-500">{i + 1}.</span> <b>{e.student.fullName}</b>
                  {q && <span className="ml-2 text-slate-500">{e.class.name}</span>}
                  {e.student.status !== 'ACTIVE' && <span className="badge ml-2 bg-amber-100 text-amber-800">{STATUS[e.student.status]}</span>}
                  {e.student.parents.length === 0 && <span className="badge ml-2 bg-red-100 text-red-700">волид нест</span>}
                </summary>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                  <ActionForm action={updateStudent} submit="Сабт" variant="small">
                    <input type="hidden" name="studentId" value={e.student.id} />
                    <label className="label">Ному насаб<input name="fullName" defaultValue={e.student.fullName} className="input" required /></label>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="label">Ҷинс
                        <select name="gender" defaultValue={e.student.gender ?? ''} className="select">
                          <option value="">—</option><option value="M">Писар</option><option value="F">Духтар</option>
                        </select>
                      </label>
                      <label className="label">Ҳолат
                        <select name="status" defaultValue={e.student.status} className="select">
                          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </label>
                      <label className="label">Синф
                        <select name="classId" defaultValue={e.classId} className="select">
                          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </label>
                    </div>
                    <p className="text-xs text-slate-500">«Муваққатан дар хориҷа» — дар журнал мемонад, вале баҳо намегирад.</p>
                  </ActionForm>
                  <ActionForm action={deleteStudent} submit="Нест кардани хонанда" variant="danger"
                    confirm={`${e.student.fullName}-ро нест мекунед? Агар дар журнал баҳо ё давомот дошта бошад, нест намешавад — ҳолатро «Хориҷ шуд» интихоб кунед.`}>
                    <input type="hidden" name="studentId" value={e.student.id} />
                  </ActionForm>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Волидон</p>
                    {e.student.parents.map((p) => (
                      <div key={p.parentUserId} className="space-y-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{p.parent.fullName} <span className="font-mono text-slate-500">{p.parent.login}</span></span>
                        <span className="flex gap-2">
                          <ActionForm action={unlinkParent} submit="Ҷудо кардан" variant="danger" confirm="Ин волидро аз хонанда ҷудо мекунед? Волид дигар баҳоҳои ӯро намебинад.">
                            <input type="hidden" name="studentId" value={e.student.id} />
                            <input type="hidden" name="parentId" value={p.parentUserId} />
                          </ActionForm>
                        </span>
                        </div>
                        {p.parent.schoolId === user.schoolId && <CredentialsEditor userId={p.parentUserId} login={p.parent.login} label="Логин ва пароли волид" />}
                      </div>
                    ))}
                    <ActionForm action={linkParent} submit="Пайваст" variant="small" className="flex gap-2">
                      <input type="hidden" name="studentId" value={e.student.id} />
                      <input name="parentLogin" placeholder="логини волиди мавҷуда" className="input font-mono" autoCapitalize="none" required />
                    </ActionForm>
                    <ActionForm action={newParentAccount} submit="Ҳисоби нави волид" variant="small" className="flex gap-2">
                      <input type="hidden" name="studentId" value={e.student.id} />
                      <input name="parentName" placeholder="ному насаби волид" className="input" />
                    </ActionForm>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </Section>
    </PageShell>
  );
}
