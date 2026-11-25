import { db } from '@/lib/db';
import { requireSchoolUser, schoolContext, STAFF } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { Avatar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import {
  createTeacherWithAssignments, createTeachers, renameUser, deleteTeacher, setUserActive,
  assignTeacher, updateAssignment, deleteAssignment, transferTeacher,
} from '@/app/actions/specialist';
import { toDbDate } from '@/lib/dates';
import { CredentialsEditor } from '@/components/CredentialsEditor';
import { formatPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';
// Сохтани паролҳо (bcrypt) вақт мегирад
export const maxDuration = 60;

type Opt = { id: number; name: string };

/** Қайдҳои синфҳо (якчанд интихоб) */
function ClassBoxes({ classes }: { classes: Opt[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {classes.map((c) => (
        <label key={c.id} className="flex cursor-pointer items-center gap-1.5 rounded-xl border-[1.5px] border-slate-200 px-3 py-1.5 text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand-light">
          <input type="checkbox" name="classIds" value={c.id} className="h-4 w-4 accent-[#0b4f8a]" /> {c.name}
        </label>
      ))}
    </div>
  );
}

export default async function TeachersPage() {
  const user = await requireSchoolUser(STAFF);
  const ctx = await schoolContext(user.schoolId);
  const today = toDbDate(ctx.today);
  const [teachers, subjects, classes] = await Promise.all([
    db.user.findMany({
      where: { schoolId: user.schoolId, role: 'TEACHER' },
      orderBy: { fullName: 'asc' },
      include: {
        teachingAssignments: {
          where: { OR: [{ activeTo: null }, { activeTo: { gte: today } }], academicYear: { isCurrent: true } },
          include: { class: true, subject: true },
          orderBy: [{ subject: { name: 'asc' } }, { class: { gradeLevel: 'asc' } }],
        },
      },
    }),
    db.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: 'asc' } }),
    ctx.year ? db.class.findMany({ where: { academicYearId: ctx.year.id }, orderBy: [{ gradeLevel: 'asc' }, { letter: 'asc' }] }) : [],
  ]);
  const active = teachers.filter((t) => t.isActive);
  const archived = teachers.filter((t) => !t.isActive);
  const ready = subjects.length > 0 && classes.length > 0;

  return (
    <PageShell user={user} title="Омӯзгорон" subtitle={`${active.length} омӯзгори фаъол${archived.length ? ` · ${archived.length} дар бойгонӣ` : ''}`}>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Section title="Омӯзгори нав" icon="plus">
          {!ready && <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Барои вобаста кардани синф аввал фанҳо ва синфҳоро илова кунед.</p>}
          <ActionForm action={createTeacherWithAssignments} submit="Илова кардан ва сохтани парол" resetOnSuccess>
            <label className="label">Ному насаби омӯзгор<input name="fullName" className="input" placeholder="Раҳимова Гулнора" required minLength={3} /></label>
            <label className="label">Рақами телефон (ихтиёрӣ — барои рӯйхати тамоси волидон)<input name="phone" type="tel" inputMode="tel" className="input" placeholder="90 123 45 67" /></label>
            {ready && (
              <>
                <label className="label">Фан
                  <select name="subjectId" className="select w-full" defaultValue="">
                    <option value="">— баъдтар —</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <div>
                  <p className="mb-1.5 text-sm font-semibold">Синфҳо</p>
                  <ClassBoxes classes={classes} />
                </div>
                <p className="text-[13px] text-slate-500">Фанҳои дигарро баъд аз сохтан дар корти омӯзгор илова кунед. Логин ва парол худкор сохта мешаванд.</p>
              </>
            )}
          </ActionForm>
          <details className="mt-4 rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-brand">Иловаи якбораи чанд омӯзгор (танҳо ном)</summary>
            <div className="mt-3">
              <ActionForm action={createTeachers} submit="Илова" variant="small" resetOnSuccess>
                <textarea name="names" rows={4} className="input" placeholder={'Ҳар омӯзгор дар сатри алоҳида'} required />
              </ActionForm>
            </div>
          </details>
        </Section>

        {active.length >= 2 && (
          <Section title="Интиқоли омӯзгор" icon="arrow">
            <p className="mb-3 text-[13px] text-slate-500">
              Ҳамаи синфу фанҳо ва ҷадвали як омӯзгор ба омӯзгори дигар мегузаранд. Журнал ва баҳоҳо бо синф мемонанд.
            </p>
            <ActionForm action={transferTeacher} submit="Интиқол" confirm="Интиқолро тасдиқ мекунед?">
              <label className="label">Аз
                <select name="fromId" className="select w-full">{active.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
              </label>
              <label className="label">Ба
                <select name="toId" className="select w-full">{active.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select>
              </label>
            </ActionForm>
          </Section>
        )}
      </div>

      <Section title={`Рӯйхат (${active.length})`} icon="users">
        {active.length === 0 ? <Empty>Ҳанӯз омӯзгор нест.</Empty> : (
          <div className="space-y-3">
            {active.map((t) => (
              <article key={t.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={t.fullName} size="md" />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate">{t.fullName}</b>
                    <span className="font-mono text-[13px] text-slate-500">{t.login}</span>
                    {t.phone && <span className="ml-2 text-[13px] text-slate-500">· {formatPhone(t.phone)}</span>}
                    {t.lockedUntil && t.lockedUntil > new Date() && <span className="pill pill-red ml-2">қуфл</span>}
                  </div>
                  <span className="pill pill-blue">{t.teachingAssignments.length} фан/синф</span>
                </div>

                {/* Тақсимот: ҳар кадом — таҳрир ва нест */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.teachingAssignments.length === 0 && <span className="text-[13px] text-amber-700">Фан ва синф вобаста нашудааст.</span>}
                  {t.teachingAssignments.map((a) => (
                    <details key={a.id} className="group relative">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-xl bg-brand-light px-3 py-1.5 text-sm font-medium text-brand hover:ring-2 hover:ring-brand/30">
                        {a.subject.name} · <b>{a.class.name}</b>
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
                      </summary>
                      <div className="absolute left-0 top-full z-20 mt-2 w-[min(320px,85vw)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                        <p className="mb-2 text-sm font-semibold">Таҳрири тақсимот</p>
                        <ActionForm action={updateAssignment} submit="Сабт" variant="small">
                          <input type="hidden" name="assignmentId" value={a.id} />
                          <label className="label">Фан
                            <select name="subjectId" defaultValue={a.subjectId} className="select w-full">{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                          </label>
                          <label className="label">Синф
                            <select name="classId" defaultValue={a.classId} className="select w-full">{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                          </label>
                        </ActionForm>
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <ActionForm action={deleteAssignment} submit="Нест кардан" variant="danger" confirm={`${a.subject.name} · ${a.class.name}-ро аз ${t.fullName} гиред? Баҳоҳо дар журнали синф мемонанд.`}>
                            <input type="hidden" name="assignmentId" value={a.id} />
                          </ActionForm>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>

                {/* Амалҳо */}
                <details className="mt-3">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-brand">
                    <Icon name="plus" className="h-4 w-4" /> Илова, таҳрир ва нест кардан
                  </summary>
                  <div className="mt-3 grid gap-4 rounded-2xl bg-slate-50 p-4 lg:grid-cols-2">
                    {ready && (
                      <div>
                        <p className="mb-2 text-sm font-semibold">Иловаи фан ва синф</p>
                        <ActionForm action={assignTeacher} submit="Вобаста кардан" variant="small">
                          <input type="hidden" name="teacherId" value={t.id} />
                          <select name="subjectId" className="select w-full" required>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                          <ClassBoxes classes={classes} />
                        </ActionForm>
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-sm font-semibold">Ному насаб ва телефон</p>
                        <ActionForm action={renameUser} submit="Сабт" variant="small">
                          <input type="hidden" name="userId" value={t.id} />
                          <input name="fullName" defaultValue={t.fullName} className="input" required minLength={3} aria-label="Ному насаб" />
                          <input name="phone" type="tel" inputMode="tel" defaultValue={t.phone ? formatPhone(t.phone) : ''} className="input" placeholder="Рақами телефон" aria-label="Рақами телефон" />
                        </ActionForm>
                      </div>
                      <CredentialsEditor userId={t.id} login={t.login} />
                      <div className="flex flex-wrap gap-2">
                        <ActionForm action={deleteTeacher} submit="Нест кардани омӯзгор" variant="danger"
                          confirm={`${t.fullName}-ро нест мекунед? Агар ӯ баҳо гузошта бошад, ҳисобаш баста ва ба бойгонӣ гузаронида мешавад (баҳоҳо дар журнал мемонанд).`}>
                          <input type="hidden" name="userId" value={t.id} />
                        </ActionForm>
                      </div>
                    </div>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </Section>

      {archived.length > 0 && (
        <Section title={`Бойгонӣ (${archived.length})`} icon="inbox">
          <ul className="divide-y divide-slate-100">
            {archived.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <Avatar name={t.fullName} />
                <span className="flex-1 text-slate-600">{t.fullName}</span>
                <ActionForm action={setUserActive} submit="Барқарор кардан" variant="small">
                  <input type="hidden" name="userId" value={t.id} />
                  <input type="hidden" name="active" value="1" />
                </ActionForm>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </PageShell>
  );
}
