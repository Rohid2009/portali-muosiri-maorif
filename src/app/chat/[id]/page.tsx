import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { myConversation } from '@/lib/chat';
import { PageShell } from '@/components/PageShell';
import { Avatar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ChatComposer } from '@/components/ChatComposer';
import { AutoRefresh, ScrollToEnd } from '@/components/AutoRefresh';
import { formatPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';

const TZ = 'Asia/Dushanbe';
const dayOf = (d: Date) => d.toLocaleDateString('ru-RU', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const timeOf = (d: Date) => d.toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/** Сӯҳбат: паёмҳо, навиштан, навсозии худкор */
export default async function ChatThread({ params }: { params: { id: string } }) {
  const me = await requireRole(['TEACHER', 'PARENT']);
  const c = await myConversation(me, Number(params.id) || 0);
  if (!c) notFound();
  const isT = me.id === c.teacherId;
  const other = isT ? c.parent : c.teacher;

  const [messages, kids] = await Promise.all([
    db.message.findMany({ where: { conversationId: c.id }, orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, senderId: true, body: true, createdAt: true } }),
    db.parentStudent.findMany({
      where: { parentUserId: c.parentId, schoolId: c.schoolId },
      select: { student: { select: { fullName: true, enrollments: { where: { academicYear: { isCurrent: true } }, select: { class: { select: { name: true } } } } } } },
    }),
  ]);
  messages.reverse();
  // Хондашуда қайд мешавад
  await db.conversation.update({ where: { id: c.id }, data: isT ? { teacherReadAt: new Date() } : { parentReadAt: new Date() } });
  const otherRead = isT ? c.parentReadAt : c.teacherReadAt;

  let lastDay = '';
  return (
    <PageShell user={me} title={other.fullName} subtitle={
      <>
        {isT ? 'Волид' : 'Омӯзгор'}
        {kids.length > 0 && ` · ${kids.map((k) => `${k.student.fullName}${k.student.enrollments[0] ? ` (${k.student.enrollments[0].class.name})` : ''}`).join(', ')}`}
        {other.phone && other.phoneVisible && <> · <a className="font-semibold text-green-700" href={`tel:+${other.phone}`}>{formatPhone(other.phone)}</a></>}
      </>
    } actions={<Link href="/chat" className="btn-ghost"><Icon name="back" className="h-4 w-4" />Ҳамаи сӯҳбатҳо</Link>}>
      <AutoRefresh seconds={8} />
      <section className="card flex flex-col p-0">
        <div className="max-h-[60vh] min-h-[300px] space-y-2 overflow-y-auto bg-slate-50/70 px-3 py-4 sm:px-5" aria-live="polite">
          {messages.length === 0 && (
            <div className="grid h-[260px] place-items-center text-center text-sm text-slate-500">
              <div><Avatar name={other.fullName} size="md" /><p className="mt-2">Паёми аввалро нависед.</p></div>
            </div>
          )}
          {messages.map((m) => {
            const mine = m.senderId === me.id;
            const d = dayOf(m.createdAt);
            const sep = d !== lastDay;
            lastDay = d;
            return (
              <div key={m.id}>
                {sep && <div className="my-3 text-center"><span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">{d}</span></div>}
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] shadow-sm ${mine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-white text-ink'}`}>
                    {m.body}
                    <span className={`mt-0.5 block text-right text-[11px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                      {timeOf(m.createdAt)}{mine && otherRead && otherRead >= m.createdAt ? ' · хонда шуд' : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <ScrollToEnd dep={messages.length} />
        </div>
        <div className="border-t border-slate-100 p-3 sm:p-4">
          <ChatComposer conversationId={c.id} disabled={!other.isActive} />
          <p className="mt-2 text-xs text-slate-400">Enter — фиристодан · Shift+Enter — сатри нав. Паёмҳо дар сервери мактаб нигоҳ дошта мешаванд.</p>
          <p className="mt-1 text-xs text-slate-500">Ҷавобро танҳо худи {isT ? 'волид' : 'омӯзгор'} менависад — дар портал чатбот ё ҷавоби худкор нест.</p>
        </div>
      </section>
    </PageShell>
  );
}
