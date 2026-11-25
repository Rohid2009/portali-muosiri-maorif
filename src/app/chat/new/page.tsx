import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { chatPair } from '@/lib/chat';

export const dynamic = 'force-dynamic';

/** Кушодани сӯҳбат бо омӯзгор/волид (агар набошад — сохта мешавад) */
export default async function NewChat({ searchParams }: { searchParams: { with?: string } }) {
  const me = await requireRole(['TEACHER', 'PARENT']);
  const pair = await chatPair(me, Number(searchParams.with) || 0);
  if (!pair) notFound();
  const c = await db.conversation.upsert({
    where: { teacherId_parentId: { teacherId: pair.teacherId, parentId: pair.parentId } },
    create: pair,
    update: {},
  });
  redirect(`/chat/${c.id}`);
}
