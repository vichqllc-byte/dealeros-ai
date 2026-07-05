import { beforeAll, describe, expect, it } from 'vitest';
import { createRandomToken, createSignedToken, hashSecret, verifySignedTokenIntegrity } from '@/lib/security/tokens';

beforeAll(() => {
  process.env.AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'test-only-auth-token-secret-do-not-use-in-production';
});

describe('signed tokens', () => {
  it('verifies a genuinely signed token and returns its id', async () => {
    const { token, id } = await createSignedToken();
    const verifiedId = await verifySignedTokenIntegrity(token);
    expect(verifiedId).toBe(id);
  });

  it('rejects a token with a tampered id', async () => {
    const { token } = await createSignedToken();
    const [, signature] = token.split('.');
    const tampered = `tampered-id.${signature}`;
    expect(await verifySignedTokenIntegrity(tampered)).toBeNull();
  });

  it('rejects a token with a tampered signature', async () => {
    const { token } = await createSignedToken();
    const [id] = token.split('.');
    expect(await verifySignedTokenIntegrity(`${id}.forged-signature`)).toBeNull();
  });

  it('rejects malformed tokens', async () => {
    expect(await verifySignedTokenIntegrity('no-dot-here')).toBeNull();
    expect(await verifySignedTokenIntegrity('')).toBeNull();
    expect(await verifySignedTokenIntegrity(undefined)).toBeNull();
    expect(await verifySignedTokenIntegrity(null)).toBeNull();
  });

  it('produces distinct random tokens on each call', () => {
    const a = createRandomToken();
    const b = createRandomToken();
    expect(a).not.toBe(b);
  });

  it('hashes deterministically for the same input', async () => {
    const value = createRandomToken();
    const hashA = await hashSecret(value);
    const hashB = await hashSecret(value);
    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(value);
  });
});
