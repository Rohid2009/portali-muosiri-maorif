import { db } from '@/lib/db';
import { requireSchoolUser, STAFF } from '@/lib/context';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { ActionForm } from '@/components/ActionForm';
import { Avatar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { reviewLinkRequest } from '@/app/actions/parent';
import { formatPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

/** Дархостҳои волидоне, ки худашон сабти ном карда, фарзандро интихоб кардаанд */
export default async function ParentRequestsPage() {
  const user = await requireSchoolUser(STAFF);
  const [pending, recent] = await Promise.all([
    db.parentLinkRequest.findMany({
      where: { schoolId: user.schoolId, status: 'PENDING' },
      include: {
        parent: { include: { children: { include: { student: true } } } },
        student: { include: { enrollments: { where: { academicYear: { isCurrent: true } }, include: { class: true } }, parents: { include: { parent: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.parentLinkRequest.findMany({
      where: { schoolId: user.schoolId, NOT: { status: 'PENDING' } },
      include: { parent: true, student: true, reviewedBy: true },
      orderBy: { reviewedAt: 'desc' },
      take: 30,
    }),
  ]);

  return (
    <PageShell user={user} title="Дархостҳои волидон" subtitle="Пеш аз тасдиқ боварӣ ҳосил кунед, ки шахс воқеан волиди хонанда аст (масалан, рақами телефонро бо дафтари синф муқоиса кунед ё занг занед).">
      <Section title={`Интизори тасдиқ (${pending.length})`} icon="inbox">
        {pending.length === 0 ? <Empty>Дархост нест.</Empty> : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="rounded-2xl border-[1.5px] border-gold/60 bg-gold-light p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <Avatar name={r.parent.fullName} size="md" />
                  <div className="min-w-0 flex-1">
                    <b>{r.parent.fullName}</b> {r.relation && <span className="pill pill-blue ml-1">{r.relation}</span>}
                    <div className="text-sm text-slate-600">{r.parent.phone ? formatPhone(r.parent.phone) : r.parent.login} · сабт: {r.createdAt.toLocaleDateString('ru-RU', { timeZone: 'Asia/Dushanbe' })}</div>
                    <div className="mt-2 text-sm">
                      Фарзанд: <b>{r.student.fullName}</b> · {r.student.enrollments[0]?.class.name ?? '—'}
                    </div>
                    {r.student.parents.length > 0 && (
                      <div className="mt-1 text-[13px] text-amber-800">
                        Ба ин хонанда аллакай пайваст: {r.student.parents.map((p) => `${p.parent.fullName}${p.parent.phone ? ` (${formatPhone(p.parent.phone)})` : ''}`).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionForm action={reviewLinkRequest} submit="Тасдиқ" variant="small">
                    <input type="hidden" name="requestId" value={r.id} />
                    <input type="hidden" name="decision" value="approve" />
                  </ActionForm>
                  <ActionForm action={reviewLinkRequest} submit="Рад" variant="danger" confirm="Дархостро рад мекунед?">
                    <input type="hidden" name="requestId" value={r.id} />
                    <input type="hidden" name="decision" value="reject" />
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Баррасишудаҳо" icon="check">
        {recent.length === 0 ? <Empty>Нест.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Волид</th><th>Телефон</th><th>Хонанда</th><th>Ҳолат</th><th>Кӣ</th></tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{r.parent.fullName}</td>
                    <td className="whitespace-nowrap">{r.parent.phone ? formatPhone(r.parent.phone) : '—'}</td>
                    <td>{r.student.fullName}</td>
                    <td>{r.status === 'APPROVED' ? <span className="pill pill-green"><Icon name="check" className="h-3.5 w-3.5" />тасдиқ</span> : <span className="pill pill-red">рад</span>}</td>
                    <td className="text-slate-500">{r.reviewedBy?.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </PageShell>
  );
}
