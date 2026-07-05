import { NextResponse } from 'next/server';
import { createRandomToken } from '@/lib/security/tokens';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

/** Double-submit cookie CSRF protection: the cookie is readable by JS by
 * design (it is not a credential on its own) so the frontend can echo it
 * back in a request header; a cross-site attacker can trigger the cookie
 * to be sent automatically but cannot read it to set the matching header. */
export function issueCsrfCookie(response: NextResponse): string {
  const token = createRandomToken();
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  return token;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyCsrf(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`));
  const cookieToken = match?.[1];
  const headerToken = request.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) return false;
  return timingSafeEqual(cookieToken, headerToken);
}
