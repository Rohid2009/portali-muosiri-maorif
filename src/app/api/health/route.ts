import { db } from '@/lib/db';

// Санҷиши саломатӣ: барои Render (healthCheckPath) ва keepalive.
// Як дархости хурд ба база — Supabase-и ройгон аз бекорӣ «хоб» намеравад.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
