import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, resetRateLimitState } from '@/lib/security/rate-limit';

describe('rate limiter', () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it('allows requests under the limit', () => {
    const result = checkRateLimit('key-a', 3, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('blocks requests once the limit is exceeded', () => {
    checkRateLimit('key-b', 2, 60);
    checkRateLimit('key-b', 2, 60);
    const third = checkRateLimit('key-b', 2, 60);
    expect(third.allowed).toBe(false);
  });

  it('tracks separate keys independently', () => {
    checkRateLimit('key-c', 1, 60);
    const other = checkRateLimit('key-d', 1, 60);
    expect(other.allowed).toBe(true);
  });
});
