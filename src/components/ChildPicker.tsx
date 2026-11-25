import { db } from '@/lib/db';
import { shortStudentName } from '@/lib/phone';

/** Мактабҳо ва синфҳои соли ҷорӣ, ки сабти номи волидонро иҷозат медиҳанд */
export async function signupOptions(schoolId?: number) {
  const schools = await db.school.findMany({
    where: { isActive: true, OR: [{ settings: null }, { settings: { allowParentSignup: true } }] },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, district: true },
  });
  const school = schools.find((s) => s.id === schoolId) ?? null;
  const classes = school
    ? await db.class.findMany({
        where: { schoolId: school.id, academicYear: { isCurrent: true } },
        orderBy: [{ gradeLevel: 'asc' }, { letter: 'asc' }],
        select: { id: true, name: true },
      })
    : [];
  return { schools, school, classes };
}

/** Қадами 1–2: интихоби мактаб ва синф (GET-форма — бе JavaScript ҳам кор мекунад) */
export function ClassChooser({
  action, schools, schoolId, classes, classId, hideSchool,
}: {
  action: string;
  schools: { id: number; name: string; district: string }[];
  schoolId?: number;
  classes: { id: number; name: string }[];
  classId?: number;
  hideSchool?: boolean;
}) {
  return (
    <form action={action} className={`grid gap-3 sm:items-end ${hideSchool ? 'sm:grid-cols-[minmax(0,1fr)_auto]' : 'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]'}`}>
      {hideSchool ? (
        <input type="hidden" name="school" value={schoolId} />
      ) : (
        <label className="label">Мактаб
          <select name="school" defaultValue={schoolId ?? ''} className="select w-full" required>
            <option value="" disabled>— интихоб кунед —</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.district}</option>)}
          </select>
        </label>
      )}
      <label className="label">Синфи фарзанд
        <select name="class" defaultValue={classId ?? ''} className="select w-full" disabled={!schoolId}>
          <option value="">{schoolId ? '— синф —' : 'аввал мактаб'}</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <button type="submit" className="btn-small min-h-[46px]">{schoolId ? 'Нишон додан' : 'Идома'}</button>
    </form>
  );
}

/**
 * Қадами 3: рӯйхати хонандагони синф — танҳо номи кӯтоҳ («Мадина Б.»),
 * то маълумоти пурраи кӯдакон ба бегонагон нишон дода нашавад.
 */
export async function StudentCheckboxes({ classId }: { classId: number }) {
  const enr = await db.classEnrollment.findMany({
    where: { classId, academicYear: { isCurrent: true }, student: { status: { in: ['ACTIVE', 'ABROAD'] } } },
    select: { studentId: true, student: { select: { fullName: true } } },
  });
  const items = enr
    .map((e) => ({ id: e.studentId, label: shortStudentName(e.student.fullName) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (!items.length) return <p className="text-slate-500">Дар ин синф ҳанӯз хонанда сабт нашудааст.</p>;
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Фарзанди худро қайд кунед (якчанд — агар бародару хоҳар дар як синф бошанд)</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] border-slate-200 px-3 py-2.5 text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand-light">
            <input type="checkbox" name="studentIds" value={s.id} className="h-4 w-4 accent-[#0b4f8a]" />
            {s.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
