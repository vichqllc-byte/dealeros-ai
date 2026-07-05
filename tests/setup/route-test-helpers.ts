import { PrismaClient } from '@prisma/client';
import { resetTestAuthState, setTestSession, setTestTokenState } from '../../lib/test/session-adapter';

export const testDb = new PrismaClient();

export async function ensureTestDatabase() {
  try {
    await testDb.$connect();
    return true;
  } catch {
    return false;
  }
}

// A matching CSRF cookie + header pair, attached to every request this
// helper builds, so route handlers that call requireCsrfToken() (see
// lib/security/guards.ts) work out of the box in tests without every
// test file needing to know about CSRF plumbing.
export const TEST_CSRF_TOKEN = 'test-csrf-token-value';

export function jsonRequest(method: string, body?: unknown, extraCookies: Record<string, string> = {}) {
  const cookieHeader = [`csrf_token=${TEST_CSRF_TOKEN}`, ...Object.entries(extraCookies).map(([k, v]) => `${k}=${v}`)].join('; ');
  return new Request('http://localhost/test', {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader, 'x-csrf-token': TEST_CSRF_TOKEN },
    body: body ? JSON.stringify(body) : undefined
  });
}

export async function jsonBody(response: Response) {
  return response.json();
}

export function useSession(session: any) {
  setTestSession(session);
}

export function useTokenState(state: 'valid' | 'missing' | 'expired' | 'invalid') {
  setTestTokenState(state);
}

export function resetAuth() {
  resetTestAuthState();
}
