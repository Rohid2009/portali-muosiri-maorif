import { NextResponse, type NextRequest } from 'next/server';

// Санҷиши сабук дар edge: бе cookie ба саҳифаҳои дохилӣ роҳ нест.
// Санҷиши АСЛӢ (сессия, нақш, мактаб) дар сервер — requireRole / assertRole.
const PROTECTED = ['/teacher', '/parent', '/specialist', '/director', '/admin', '/change-password', '/chat'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    if (!req.cookies.get('sid')) return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|icon.svg).*)'],
};
