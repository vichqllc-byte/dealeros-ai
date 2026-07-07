import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '@/lib/validators/auth';

describe('auth validators', () => {
  it('accepts valid login payload', () => {
    const payload = loginSchema.parse({ email: 'owner@dealeros.ai', password: 'password123' });
    expect(payload.email).toBe('owner@dealeros.ai');
  });

  it('rejects short password for register payload', () => {
    expect(() => registerSchema.parse({
      email: 'owner@dealeros.ai',
      password: 'short',
      firstName: 'Demo',
      lastName: 'Owner',
      organizationName: 'DealersOS'
    })).toThrow();
  });
});
