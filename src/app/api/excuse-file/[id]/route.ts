import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { signedUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** Файли ҳуҷҷат — танҳо барои мутахассис/мудири ҳамон мактаб, бо пайванди 5-дақиқаина */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !['SPECIALIST', 'DIRECTOR'].includes(user.role)) {
    return new NextResponse('Дастрасӣ манъ аст', { status: 403 });
  }
  const doc = await db.excuseDocument.findUnique({ where: { id: Number(params.id) || 0 } });
  if (!doc || doc.schoolId !== user.schoolId || !doc.fileKey) return new NextResponse('Ёфт нашуд', { status: 404 });
  const url = await signedUrl(doc.fileKey);
  if (!url) return new NextResponse('Файл дастрас нест', { status: 404 });
  return NextResponse.redirect(url);
}
