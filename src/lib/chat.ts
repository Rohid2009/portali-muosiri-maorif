import 'server-only';
import { db } from './db';
import type { CurrentUser } from './auth';

/**
 * Чат танҳо байни омӯзгор ва волид, ки фарзандаш дар мактаби ҳамон омӯзгор мехонад.
 * Бармегардонад { teacherId, parentId, schoolId } ё null.
 */
export async function chatPair(me: CurrentUser, otherId: number) {
  const other = await db.user.findUnique({ where: { id: otherId }, select: { id: true, role: true, schoolId: true, isActive: true } });
  if (!other || !other.isActive) return null;
  let teacher: { id: number; schoolId: number | null }, parentId: number;
  if (me.role === 'TEACHER' && other.role === 'PARENT') { teacher = { id: me.id, schoolId: me.schoolId }; parentId = other.id; }
  else if (me.role === 'PARENT' && other.role === 'TEACHER') { teacher = { id: other.id, schoolId: other.schoolId }; parentId = me.id; }
  else return null;
  if (teacher.schoolId === null) return null;
  const link = await db.parentStudent.findFirst({ where: { parentUserId: parentId, schoolId: teacher.schoolId }, select: { schoolId: true } });
  if (!link) return null;
  return { teacherId: teacher.id, parentId, schoolId: teacher.schoolId };
}

/** Сӯҳбате, ки корбар узви он аст (ё null) */
export async function myConversation(me: CurrentUser, conversationId: number) {
  const c = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      teacher: { select: { id: true, fullName: true, phone: true, phoneVisible: true, isActive: true } },
      parent: { select: { id: true, fullName: true, phone: true, phoneVisible: true, isActive: true } },
    },
  });
  if (!c || (c.teacherId !== me.id && c.parentId !== me.id)) return null;
  return c;
}

/** Шумораи сӯҳбатҳо бо паёмҳои нонхонда */
export async function unreadChats(me: CurrentUser): Promise<number> {
  if (me.role !== 'TEACHER' && me.role !== 'PARENT') return 0;
  const isT = me.role === 'TEACHER';
  const list = await db.conversation.findMany({
    where: { [isT ? 'teacherId' : 'parentId']: me.id, lastSenderId: { not: me.id }, lastMessageAt: { not: null } },
    select: { lastMessageAt: true, teacherReadAt: true, parentReadAt: true },
  });
  return list.filter((c) => {
    const read = isT ? c.teacherReadAt : c.parentReadAt;
    return !read || (c.lastMessageAt && c.lastMessageAt > read);
  }).length;
}
