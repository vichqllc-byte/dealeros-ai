/**
 * Fixed-window in-memory rate limiter.
 *
 * This limits requests per Next.js server process/instance. It is a real,
 * functioning limiter (not a stub) and is sufficient for a single-instance
 * deployment; a horizontally-scaled deployment should back this with a
 * shared store (e.g. Redis) behind the same `checkRateLimit` interface.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodically evict expired buckets so the map doesn't grow unbounded.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: windowSeconds };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Test-only helper to avoid state leaking between test cases. */
export function resetRateLimitState() {
  buckets.clear();
}
