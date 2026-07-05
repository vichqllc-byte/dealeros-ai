import { describe, expect, it } from 'vitest';
import { hashPassword, isPasswordAllowed, verifyPassword } from '@/lib/security/password';

describe('password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('Correct-Horse-Battery-Staple-1');
    expect(await verifyPassword(hash, 'Correct-Horse-Battery-Staple-1')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('Correct-Horse-Battery-Staple-1');
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });

  it('produces different hashes for the same password (unique salts)', async () => {
    const hashA = await hashPassword('Correct-Horse-Battery-Staple-1');
    const hashB = await hashPassword('Correct-Horse-Battery-Staple-1');
    expect(hashA).not.toBe(hashB);
  });
});

describe('password policy', () => {
  it('rejects passwords shorter than 12 characters', () => {
    expect(isPasswordAllowed('Short1!').ok).toBe(false);
  });

  it('rejects common weak passwords', () => {
    expect(isPasswordAllowed('password123').ok).toBe(false);
  });

  it('rejects passwords containing the account email', () => {
    expect(isPasswordAllowed('jsmith-super-secret', 'jsmith@example.com').ok).toBe(false);
  });

  it('accepts a strong, sufficiently long password', () => {
    expect(isPasswordAllowed('correct-horse-battery-staple-9x').ok).toBe(true);
  });
});
