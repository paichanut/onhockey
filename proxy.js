import { NextResponse } from 'next/server';

// icehockeytvguide.vercel.app serves only the YouTube-only guide (the Play Store app's site):
// its home page is /guide, and nothing from the onhockey.tv side of the project is reachable.
const GUIDE_HOST = 'icehockeytvguide.';
const GUIDE_PATHS = ['/guide', '/privacy', '/api/youtube'];

export function proxy(request) {
  const host = request.headers.get('host') || '';
  if (!host.startsWith(GUIDE_HOST)) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (pathname === '/') return NextResponse.rewrite(new URL('/guide', request.url));
  if (GUIDE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();
  return new NextResponse('Not found', { status: 404 });
}

export const config = {
  // Next's own assets and Vercel's analytics script are served as usual.
  matcher: ['/((?!_next/|_vercel/|favicon.ico).*)'],
};
