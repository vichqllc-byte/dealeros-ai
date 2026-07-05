import { describe, expect, it, vi } from 'vitest';
import { InMemoryCacheClient } from '@/lib/cache/cache-client';

describe('InMemoryCacheClient', () => {
  it('returns undefined for a missing key', async () => {
    const cache = new InMemoryCacheClient();
    expect(await cache.get('missing')).toBeUndefined();
  });

  it('stores and retrieves a value within its TTL', async () => {
    const cache = new InMemoryCacheClient();
    await cache.set('key', { a: 1 }, 60_000);
    expect(await cache.get('key')).toEqual({ a: 1 });
  });

  it('expires a value after its TTL elapses', async () => {
    vi.useFakeTimers();
    try {
      const cache = new InMemoryCacheClient();
      await cache.set('key', 'value', 1000);
      vi.advanceTimersByTime(1001);
      expect(await cache.get('key')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('deletes a key', async () => {
    const cache = new InMemoryCacheClient();
    await cache.set('key', 'value', 60_000);
    await cache.delete('key');
    expect(await cache.get('key')).toBeUndefined();
  });
});
