import { AppError } from '@/lib/api/responses';
import { verifyCsrf } from '@/lib/security/csrf';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { API_KEY_PREFIX } from '@/lib/security/api-key-format';

export function requireCsrfToken(request: Request) {
  // CSRF is an attack that abuses a browser's *ambient* credential (an
  // auth cookie sent automatically on cross-site requests). A request
  // carrying an explicit `Authorization: Bearer` API key isn't ambient -
  // a browser never attaches it on its own, and JS on another origin
  // can't read/set it without CORS permission - so there is nothing here
  // for CSRF to forge. Every real bearer-token API (Stripe, GitHub, ...)
  // makes the same distinction.
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith(`Bearer ${API_KEY_PREFIX}`)) return;

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
