import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { PageShell, Section, Empty } from '@/components/PageShell';
import { Directory, type DirectoryItem } from '@/components/Directory';

export const dynamic = 'force-dynamic';

/** Волид: рӯйхати омӯзгорони мактаб(ҳо)-и фарзандонаш бо фан, синф ва телефон */
export default async function TeachersDirectory() {
  const user = await requireRole(['PARENT']);
  const kids = await db.parentStudent.findMany({
    where: { parentUserId: user.id },
    select: { schoolId: true, student: { select: { enrollments: { where: { academicYear: { isCurrent: true } }, select: { classId: true } } } } },
  });
  const schoolIds = [...new Set(kids.map((k) => k.schoolId))];
  const kidClasses = new Set(kids.flatMap((k) => k.student.enrollments.map((e) => e.classId)));

  if (schoolIds.length === 0) {
    return (
      <PageShell user={user} title="Омӯзгорон">
        <Section><Empty>Рӯйхат пас аз тасдиқи фарзанд аз ҷониби мутахассис дастрас мешавад.</Empty></Section>
      </PageShell>
    );
  }

  const teachers = await db.user.findMany({
    where: { schoolId: { in: schoolIds }, role: 'TEACHER', isActive: true },
    select: {
      id: true, fullName: true, phone: true, phoneVisible: true,
      teachingAssignments: { where: { activeTo: null, academicYear: { isCurrent: true } }, select: { classId: true, class: { select: { name: true } }, subject: { select: { name: true } } } },
    },
    orderBy: { fullName: 'asc' },
  });

  const items: DirectoryItem[] = teachers.map((t) => {
    // «Математика — 7-А, 8-Г»
    const bySubject = new Map<string, string[]>();
    for (const a of t.teachingAssignments) bySubject.set(a.subject.name, [...(bySubject.get(a.subject.name) ?? []), a.class.name]);
    const lines = [...bySubject].map(([s, cs]) => `${s} — ${cs.join(', ')}`);
    const teachesMyKid = t.teachingAssignments.some((a) => kidClasses.has(a.classId));
    return {
      id: t.id,
      name: t.fullName,
      lines: teachesMyKid ? ['Омӯзгори фарзанди шумо', ...lines] : lines.length ? lines : ['—'],
      phone: t.phoneVisible ? t.phone : null,
      highlight: teachesMyKid,
      chatHref: `/chat/new?with=${t.id}`,
    };
  });

  return (
    <PageShell user={user} title="Омӯзгорон" subtitle="Омӯзгорони фарзанди шумо болотар ва ранга нишон дода мешаванд.">
      <Section>
        <Directory items={items} placeholder="Ҷустуҷӯ аз рӯи номи омӯзгор…" />
      </Section>
    </PageShell>
  );
}
