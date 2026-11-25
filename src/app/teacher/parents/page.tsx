import { db } from '@/lib/db';
import { requireSchoolUser } from '@/lib/context';
import { PageShell, Section } from '@/components/PageShell';
import { Directory, type DirectoryItem } from '@/components/Directory';

export const dynamic = 'force-dynamic';

/** Омӯзгор: рӯйхати ҳамаи волидони мактаб бо фарзанд, синф ва телефон */
export default async function ParentsDirectory() {
  const user = await requireSchoolUser(['TEACHER']);
  const [links, myClasses] = await Promise.all([
    db.parentStudent.findMany({
      where: { schoolId: user.schoolId, parent: { isActive: true } },
      include: {
        parent: { select: { id: true, fullName: true, phone: true, phoneVisible: true } },
        student: { select: { fullName: true, enrollments: { where: { academicYear: { isCurrent: true } }, select: { classId: true, class: { select: { name: true } } } } } },
      },
    }),
    db.teachingAssignment.findMany({ where: { teacherId: user.id, activeTo: null }, select: { classId: true } }),
  ]);
  const mine = new Set(myClasses.map((c) => c.classId));

  // Як волид — як сатр, ҳамаи фарзандонаш дар зер
  const byParent = new Map<number, DirectoryItem>();
  for (const l of links) {
    const enr = l.student.enrollments[0];
    const line = `${l.student.fullName}${enr ? ` · ${enr.class.name}` : ''}`;
    const cur = byParent.get(l.parent.id);
    if (cur) {
      cur.lines.push(line);
      if (enr && mine.has(enr.classId)) cur.highlight = true;
    } else {
      byParent.set(l.parent.id, {
        id: l.parent.id,
        name: l.parent.fullName,
        lines: [line],
        phone: l.parent.phoneVisible ? l.parent.phone : null,
        highlight: !!enr && mine.has(enr.classId),
        chatHref: `/chat/new?with=${l.parent.id}`,
      });
    }
  }
  const items = [...byParent.values()];

  return (
    <PageShell user={user} title="Волидон" subtitle="Рӯйхати волидони мактаб. Волидони хонандагони синфҳои шумо болотар ва ранга нишон дода мешаванд.">
      <Section>
        <Directory items={items} placeholder="Ҷустуҷӯ аз рӯи номи волид…" />
      </Section>
    </PageShell>
  );
}
