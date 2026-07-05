import { AppError } from '@/lib/api/responses';
import { verifyCsrf } from '@/lib/security/csrf';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

export function requireCsrfToken(request: Request) {
  if (!verifyCsrf(request)) {
    throw new AppError('Invalid or missing CSRF token', 403, 'CSRF_ERROR');
  }
}

export function enforceRateLimit(request: Request, routeKey: string, limit: number, windowSeconds: number) {
  const ip = getClientIp(request);
  const result = checkRateLimit(`${routeKey}:${ip}`, limit, windowSeconds);
  if (!result.allowed) {
    throw new AppError('Too many requests. Please try again later.', 429, 'RATE_LIMITED');
  }
}
