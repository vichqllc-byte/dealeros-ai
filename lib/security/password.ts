import { hash, verify } from '@node-rs/argon2';

// OWASP-recommended Argon2id parameters for interactive login (m=19MiB, t=2, p=1).
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return hash(plainTextPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, plainTextPassword: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plainTextPassword);
  } catch {
    return false;
  }
}

const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password123', '12345678', '123456789', 'qwerty123',
  'letmein123', 'admin1234', 'welcome123', 'iloveyou1', 'password1!'
]);

/** OWASP ASVS-aligned password policy: prioritize length over forced complexity rules. */
export function isPasswordAllowed(password: string, email?: string): { ok: true } | { ok: false; reason: string } {
  if (password.length < 12) return { ok: false, reason: 'Password must be at least 12 characters long' };
  if (password.length > 128) return { ok: false, reason: 'Password must be at most 128 characters long' };
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, reason: 'Password is too common; choose a stronger password' };
  }
  if (email && password.toLowerCase().includes(email.toLowerCase().split('@')[0])) {
    return { ok: false, reason: 'Password must not contain your email address' };
  }
  return { ok: true };
}
