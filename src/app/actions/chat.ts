'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertRole } from '@/lib/auth';
import { myConversation } from '@/lib/chat';
import { audit } from '@/lib/audit';
import { done, fail, errorMessage, type FormState } from '@/lib/form';

const MAX_LEN = 2000;
const MIN_GAP_MS = 1500;        // байни ду паёми як нафар
const MIN_TYPING_MS = 1200;     // аз кушодани саҳифа то фиристодан

/**
 * Фиристодани паём (омӯзгор ↔ волид).
 *
 * Дар портал чатбот ё ҷавоби худкор НЕСТ ва набояд бошад: паёмро танҳо худи
 * омӯзгор ё волид аз ҳисоби худ мефиристад. Ҳимояҳо:
 *  - танҳо тавассути сессияи воридшуда (cookie-и httpOnly) ва server action — API-и кушода нест;
 *  - фиристанда ҳамеша худи корбари сессия аст (ба номи каси дигар навиштан мумкин нест);
 *  - мутахассис, мудир ва админ ба чат дастрасӣ надоранд;
 *  - майдони пинҳонӣ («дом» барои ботҳо): агар пур шуда бошад — рад;
 *  - фиристодан аз саҳифа зудтар аз 1.2 с баъди кушодан — рад (скриптҳо);
 *  - байни паёмҳо камаш 1.5 с, то 40 паём дар 10 дақиқа, паёми такрорӣ дар 1 дақиқа — рад.
 */
export async function sendMessage(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await assertRole(['TEACHER', 'PARENT']);
    const c = await myConversation(me, Number(fd.get('conversationId')) || 0);
    if (!c) throw new Error('Сӯҳбат ёфт нашуд.');
    if (!c.teacher.isActive || !c.parent.isActive) throw new Error('Ин ҳисоб ғайрифаъол аст — паём фиристода намешавад.');
    // Дом барои ботҳо: одам ин майдонро намебинад ва пур намекунад
    if (String(fd.get('website') ?? '') !== '') throw new Error('Паём қабул нашуд.');
    const openedAt = Number(fd.get('openedAt')) || 0;
    if (!openedAt || Date.now() - openedAt < MIN_TYPING_MS) throw new Error('Паём хеле зуд фиристода шуд — боз кӯшиш кунед.');

    const body = String(fd.get('body') ?? '').replace(/\r\n/g, '\n').trim();
    if (!body) throw new Error('Паём холӣ аст.');
    if (body.length > MAX_LEN) throw new Error(`Паём набояд аз ${MAX_LEN} аломат зиёд бошад.`);
    // Ҳимоя аз спам: то 40 паём дар 10 дақиқа
    const recent = await db.message.count({ where: { senderId: me.id, createdAt: { gte: new Date(Date.now() - 600_000) } } });
    if (recent >= 40) throw new Error('Паёмҳо зиёд шуданд. Каме баъд боз нависед.');
    const last = await db.message.findFirst({ where: { senderId: me.id }, orderBy: { createdAt: 'desc' }, select: { body: true, createdAt: true, conversationId: true } });
    if (last && Date.now() - last.createdAt.getTime() < MIN_GAP_MS) throw new Error('Каме оҳистатар нависед.');
    if (last && last.conversationId === c.id && last.body === body && Date.now() - last.createdAt.getTime() < 60_000) throw new Error('Ин паём аллакай фиристода шуд.');

    const now = new Date();
    await db.$transaction([
      db.message.create({ data: { conversationId: c.id, senderId: me.id, body } }),
      db.conversation.update({
        where: { id: c.id },
        data: { lastMessageAt: now, lastSenderId: me.id, ...(me.role === 'TEACHER' ? { teacherReadAt: now } : { parentReadAt: now }) },
      }),
    ]);
    // Матни паём ба сабти тағйирот навишта намешавад — танҳо худи амал
    await audit({ action: 'chat.send', actorId: me.id, schoolId: c.schoolId, entity: 'Conversation', entityId: c.id });
    revalidatePath(`/chat/${c.id}`);
    revalidatePath('/chat');
    return done('');
  } catch (e) {
    return fail(errorMessage(e));
  }
}
