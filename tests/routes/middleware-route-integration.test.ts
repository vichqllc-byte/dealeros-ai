import { describe, expect, it } from 'vitest';
import { middleware } from '../../middleware';
import { ACCESS_TOKEN_COOKIE } from '@/lib/security/cookies';
import { createSignedToken } from '@/lib/security/tokens';

function makeRequest(pathname: string, cookiesMap: Record<string, string> = {}) {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
    cookies: { get: (key: string) => cookiesMap[key] ? { value: cookiesMap[key] } : undefined }
  } as any;
}

describe('middleware route integration', () => {
  it('missing token returns json error for protected api', async () => {
    const res = (await middleware(makeRequest('/api/vehicles'))) as any;
    expect(res.status).toBe(401);
  });

  it('forged token returns json error for protected api', async () => {
    const res = (await middleware(makeRequest('/api/vehicles', { [ACCESS_TOKEN_COOKIE]: 'forged.signature' }))) as any;
    expect(res.status).toBe(401);
  });

  it('malformed token returns json error for protected api', async () => {
    const res = (await middleware(makeRequest('/api/vehicles', { [ACCESS_TOKEN_COOKIE]: 'not-a-token' }))) as any;
    expect(res.status).toBe(401);
  });

  it('genuinely signed token passes protected api boundary', async () => {
    const { token } = await createSignedToken();
    const res = (await middleware(makeRequest('/api/vehicles', { [ACCESS_TOKEN_COOKIE]: token }))) as any;
    expect(res.status).toBe(200);
  });

  it('genuinely signed token passes vin-analyses boundary', async () => {
    const { token } = await createSignedToken();
    const res = (await middleware(makeRequest('/api/vin-analyses', { [ACCESS_TOKEN_COOKIE]: token }))) as any;
    expect(res.status).toBe(200);
  });

  it('genuinely signed token passes admin page boundary', async () => {
    const { token } = await createSignedToken();
    const res = (await middleware(makeRequest('/admin', { [ACCESS_TOKEN_COOKIE]: token }))) as any;
    expect(res.status).toBe(200);
  });

  it('protected page redirects safely when missing token', async () => {
    const res = (await middleware(makeRequest('/dealer'))) as any;
    expect(res.status).toBe(307);
  });

  it('does not redirect public home page', async () => {
    const res = (await middleware(makeRequest('/'))) as any;
    expect(res.status).toBe(200);
  });
});
