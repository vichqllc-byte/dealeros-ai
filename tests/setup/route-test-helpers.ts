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

export function jsonRequest(method: string, body?: unknown) {
  return new Request('http://localhost/test', {
    method,
    headers: { 'Content-Type': 'application/json' },
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
