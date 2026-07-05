import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';

function makeRequest(pathname: string, cookiesMap: Record<string, string> = {}) {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
    cookies: { get: (key: string) => cookiesMap[key] ? { value: cookiesMap[key] } : undefined }
  } as any;
}

describe('middleware auth lifecycle', () => {
  it('returns json error for missing api token', () => {
    const res = middleware(makeRequest('/api/vehicles')) as any;
    expect(res.status).toBe(401);
  });

  it('returns json error for expired api token without refresh token', () => {
    const res = middleware(makeRequest('/api/vehicles', { 'sb-access-token': 'expired' })) as any;
    expect(res.status).toBe(401);
  });

  it('returns json error for invalid api token', () => {
    const res = middleware(makeRequest('/api/vehicles', { 'sb-access-token': 'invalid' })) as any;
    expect(res.status).toBe(401);
  });

  it('redirects protected page for missing token', () => {
    const res = middleware(makeRequest('/dealer')) as any;
    expect(res.status).toBe(307);
  });

  it('allows request when refresh token exists with expired access token', () => {
    const res = middleware(makeRequest('/dealer', { 'sb-access-token': 'expired', 'sb-refresh-token': 'refresh-ok' })) as any;
    expect(res.status).toBe(200);
  });
});
