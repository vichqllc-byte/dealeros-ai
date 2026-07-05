import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateRequiredEnv } from '@/lib/config/validate-env';

describe('validateRequiredEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.DIRECT_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.AUTH_TOKEN_SECRET = 'a-sufficiently-long-secret-value';
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('does not throw when every required var is present and valid', () => {
    expect(() => validateRequiredEnv()).not.toThrow();
  });

  it('throws listing every missing variable', () => {
    delete process.env.DATABASE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(() => validateRequiredEnv()).toThrow(/DATABASE_URL.*NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_APP_URL.*DATABASE_URL/);
  });

  it('throws when AUTH_TOKEN_SECRET is too short', () => {
    process.env.AUTH_TOKEN_SECRET = 'too-short';
    expect(() => validateRequiredEnv()).toThrow(/at least 16 characters/);
  });
});
