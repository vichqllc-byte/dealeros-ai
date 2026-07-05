import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';
import { ACCESS_TOKEN_COOKIE } from '@/lib/security/cookies';
import { createSignedToken } from '@/lib/security/tokens';

function makeRequest(pathname: string, cookiesMap: Record<string, string> = {}) {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
    cookies: { get: (key: string) => cookiesMap[key] ? { value: cookiesMap[key] } : undefined }
  } as any;
}

describe('middleware auth lifecycle', () => {
  it('returns json error for missing api token', async () => {
    const res = (await middleware(makeRequest('/api/vehicles'))) as any;
    expect(res.status).toBe(401);
  });

  it('returns json error for a tampered/forged api token', async () => {
    const res = (await middleware(makeRequest('/api/vehicles', { [ACCESS_TOKEN_COOKIE]: 'forged.signature' }))) as any;
    expect(res.status).toBe(401);
  });

  it('returns json error for a malformed api token', async () => {
    const res = (await middleware(makeRequest('/api/vehicles', { [ACCESS_TOKEN_COOKIE]: 'not-a-valid-token-shape' }))) as any;
    expect(res.status).toBe(401);
  });

  it('redirects protected page for missing token', async () => {
    const res = (await middleware(makeRequest('/dealer'))) as any;
    expect(res.status).toBe(307);
  });

  it('allows request through when the access token has a genuine signature', async () => {
    const { token } = await createSignedToken();
    const res = (await middleware(makeRequest('/dealer', { [ACCESS_TOKEN_COOKIE]: token }))) as any;
    expect(res.status).toBe(200);
  });
});
