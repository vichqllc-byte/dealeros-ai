type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, options?: { max?: number; windowMs?: number }) {
  const max = options?.max ?? 15;
  const windowMs = options?.windowMs ?? 60_000;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  if (bucket.count >= max) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, remaining: Math.max(0, max - bucket.count) };
}

export function clientFingerprint(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip');
  const userAgent = request.headers.get('user-agent') ?? 'unknown-agent';
  return `${forwarded ?? realIp ?? 'unknown-ip'}:${userAgent.slice(0, 80)}`;
}
