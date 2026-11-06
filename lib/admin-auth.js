// /admin is protected by the ADMIN_PASSWORD environment variable. Logging in sets an httpOnly
// cookie holding an HMAC of the password, so changing the password logs everyone out.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'onhockey_admin';

const token = (password) => createHmac('sha256', password).update('onhockey-admin-v1').digest('hex');

export const adminEnabled = () => !!process.env.ADMIN_PASSWORD;

export function passwordMatches(password) {
  if (!adminEnabled() || typeof password !== 'string') return false;
  const a = Buffer.from(token(password));
  const b = Buffer.from(token(process.env.ADMIN_PASSWORD));
  return timingSafeEqual(a, b);
}

export const sessionToken = () => token(process.env.ADMIN_PASSWORD);

export function isAdmin(request) {
  if (!adminEnabled()) return false;
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value || '';
  const expected = sessionToken();
  return cookie.length === expected.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}
