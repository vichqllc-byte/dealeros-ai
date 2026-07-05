import { describe, expect, it } from 'vitest';
import { requireCsrfToken } from '@/lib/security/guards';

function requestWithAuthHeader(authorization?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authorization) headers.authorization = authorization;
  return new Request('http://localhost/test', { method: 'POST', headers, body: '{}' });
}

describe('CSRF exemption for bearer API key requests', () => {
  it('does not throw for a request bearing a valid-shaped API key, even with no CSRF cookie/header', () => {
    expect(() => requireCsrfToken(requestWithAuthHeader('Bearer dos_some-token-value'))).not.toThrow();
  });

  it('still enforces CSRF for a request with no Authorization header', () => {
    expect(() => requireCsrfToken(requestWithAuthHeader())).toThrow(/CSRF/);
  });

  it('still enforces CSRF for a Bearer token that is not one of our API keys', () => {
    // e.g. some other Bearer scheme/token that doesn't match our API key
    // prefix - should not accidentally exempt arbitrary bearer traffic.
    expect(() => requireCsrfToken(requestWithAuthHeader('Bearer some-other-token'))).toThrow(/CSRF/);
  });
});
