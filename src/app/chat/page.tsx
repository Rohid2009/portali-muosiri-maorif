import Link from 'next/link';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { Avatar } from '@/components/ui';
import { AutoRefresh } from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

function when(d: Date | null): string {
  if (!d) return '';
  const tz = 'Asia/Dushanbe';
  const day = (x: Date) => x.toLocaleDateString('ru-RU', { timeZone: tz });
  return day(d) === day(new Date())
    ? d.toLocaleTimeString('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru-RU', { timeZone: tz, day: '2-digit', month: '2-digit' });
}

/** Рӯйхати сӯҳбатҳо */
export default async function ChatList() {
  const me = await requireRole(['TEACHER', 'PARENT']);
  const isT = me.role === 'TEACHER';
  const list = await db.conversation.findMany({
    where: isT ? { teacherId: me.id } : { parentId: me.id },
    include: {
      teacher: { select: { fullName: true } },
      parent: { select: { fullName: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, senderId: true } },
    },
    orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  });

  return (
    <PageShell
      user={me}
      title="Чат"
      subtitle={isT ? 'Мукотиба бо волидон' : 'Мукотиба бо омӯзгорон'}
      actions={<Link href={isT ? '/teacher/parents' : '/parent/teachers'} className="btn-small">+ Сӯҳбати нав</Link>}
    >
      <AutoRefresh seconds={15} />
      <Section>
        {list.length === 0 ? (
          <Empty>Ҳанӯз сӯҳбат нест. Аз рӯйхати {isT ? 'волидон' : 'омӯзгорон'} касро интихоб карда «Навиштан»-ро пахш кунед.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((c) => {
              const other = isT ? c.parent.fullName : c.teacher.fullName;
              const read = isT ? c.teacherReadAt : c.parentReadAt;
              const unread = c.lastSenderId !== null && c.lastSenderId !== me.id && c.lastMessageAt && (!read || c.lastMessageAt > read);
              const last = c.messages[0];
              return (
                <li key={c.id}>
                  <Link href={`/chat/${c.id}`} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-50">
                    <Avatar name={other} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <b className={`truncate ${unread ? '' : 'font-semibold'}`}>{other}</b>
                        <span className="shrink-0 text-xs text-slate-500">{when(c.lastMessageAt)}</span>
                      </span>
                      <span className={`block truncate text-sm ${unread ? 'font-semibold text-ink' : 'text-slate-500'}`}>
                        {last ? `${last.senderId === me.id ? 'Шумо: ' : ''}${last.body}` : 'Ҳанӯз паём нест'}
                      </span>
                    </span>
                    {unread && <span className="h-3 w-3 shrink-0 rounded-full bg-brand" aria-label="нонхонда" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
