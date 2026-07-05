import type { AuthSession } from '@/lib/auth/session';

let currentSession: AuthSession | null = null;
let currentTokenState: 'valid' | 'missing' | 'expired' | 'invalid' = 'valid';

export function setTestSession(session: AuthSession | null) {
  currentSession = session;
}

export function getTestSession() {
  return currentSession;
}

export function setTestTokenState(state: 'valid' | 'missing' | 'expired' | 'invalid') {
  currentTokenState = state;
}

export function getTestTokenState() {
  return currentTokenState;
}

export function resetTestAuthState() {
  currentSession = null;
  currentTokenState = 'valid';
}
