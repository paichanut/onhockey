import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminEnabled, isAdmin, passwordMatches, sessionToken } from '@/lib/admin-auth';

// GET: am I logged in?  POST {password}: log in.  DELETE: log out.
export async function GET(request) {
  return Response.json({ enabled: adminEnabled(), loggedIn: isAdmin(request) });
}

export async function POST(request) {
  if (!adminEnabled()) return Response.json({ error: 'The dashboard is not set up (ADMIN_PASSWORD missing).' }, { status: 503 });
  const { password } = await request.json().catch(() => ({}));
  if (!passwordMatches(password)) return Response.json({ error: 'Wrong password.' }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, sessionToken(), {
    httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
