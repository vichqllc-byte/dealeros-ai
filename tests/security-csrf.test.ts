import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';
import { CSRF_COOKIE, CSRF_HEADER, issueCsrfCookie, verifyCsrf } from '@/lib/security/csrf';

function extractSetCookieValue(response: NextResponse, name: string): string | undefined {
  const cookie = response.cookies.get(name);
  return cookie?.value;
}

describe('csrf double-submit protection', () => {
  it('issues a csrf cookie value', () => {
    const response = NextResponse.json({ ok: true });
    const token = issueCsrfCookie(response);
    expect(extractSetCookieValue(response, CSRF_COOKIE)).toBe(token);
  });

  it('accepts a request whose header matches the cookie', () => {
    const token = 'matching-token-value';
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { Cookie: `${CSRF_COOKIE}=${token}`, [CSRF_HEADER]: token }
    });
    expect(verifyCsrf(request)).toBe(true);
  });

  it('rejects a request whose header does not match the cookie', () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { Cookie: `${CSRF_COOKIE}=token-a`, [CSRF_HEADER]: 'token-b' }
    });
    expect(verifyCsrf(request)).toBe(false);
  });

  it('rejects a request missing the csrf header', () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { Cookie: `${CSRF_COOKIE}=token-a` }
    });
    expect(verifyCsrf(request)).toBe(false);
  });

  it('rejects a request missing the csrf cookie', () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { [CSRF_HEADER]: 'token-a' }
    });
    expect(verifyCsrf(request)).toBe(false);
  });
});
