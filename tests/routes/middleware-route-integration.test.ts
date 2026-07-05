import { describe, expect, it } from 'vitest';
import { middleware } from '../../middleware';

function makeRequest(pathname: string, cookiesMap: Record<string, string> = {}) {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
    cookies: { get: (key: string) => cookiesMap[key] ? { value: cookiesMap[key] } : undefined }
  } as any;
}

describe('middleware route integration', () => {
  it('missing token returns json error for protected api', () => {
    const res = middleware(makeRequest('/api/vehicles')) as any;
    expect(res.status).toBe(401);
  });

  it('expired token returns json error for protected api', () => {
    const res = middleware(makeRequest('/api/vehicles', { 'sb-access-token': 'expired' })) as any;
    expect(res.status).toBe(401);
  });

  it('invalid token returns json error for protected api', () => {
    const res = middleware(makeRequest('/api/vehicles', { 'sb-access-token': 'invalid' })) as any;
    expect(res.status).toBe(401);
  });

  it('valid dealer token passes protected api', () => {
    const res = middleware(makeRequest('/api/vehicles', { 'sb-access-token': 'valid-dealer' })) as any;
    expect(res.status).toBe(200);
  });

  it('valid vendor token passes middleware boundary', () => {
    const res = middleware(makeRequest('/api/vin-analyses', { 'sb-access-token': 'valid-vendor' })) as any;
    expect(res.status).toBe(200);
  });

  it('valid admin token passes middleware boundary', () => {
    const res = middleware(makeRequest('/admin', { 'sb-access-token': 'valid-admin' })) as any;
    expect(res.status).toBe(200);
  });

  it('protected page redirects safely when missing token', () => {
    const res = middleware(makeRequest('/dealer')) as any;
    expect(res.status).toBe(307);
  });

  it('does not redirect public home page', () => {
    const res = middleware(makeRequest('/')) as any;
    expect(res.status).toBe(200);
  });
});
