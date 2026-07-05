/**
 * Generic cache boundary. `InMemoryCacheClient` is real and fully
 * functional for single-instance deployments (same scope caveat already
 * documented on lib/security/rate-limit.ts's in-memory rate limiter: it
 * doesn't share state across horizontally-scaled instances).
 *
 * A REDIS_URL-backed implementation of this same interface is the
 * natural next step for multi-instance deployments. It isn't built here
 * because no Redis client package is installed in this project and
 * there's no live Redis instance to verify a real implementation
 * against - a fake/no-op class pretending to speak the Redis protocol
 * would be worse than being explicit about the gap (the same honesty
 * rule already applied to premium VIN-data providers and e-signatures).
 */
export interface CacheClient {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class InMemoryCacheClient implements CacheClient {
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

let defaultClient: CacheClient | null = null;

export function getDefaultCacheClient(): CacheClient {
  if (!defaultClient) defaultClient = new InMemoryCacheClient();
  return defaultClient;
}
