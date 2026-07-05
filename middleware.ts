import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE } from '@/lib/security/cookies';
import { API_KEY_PREFIX } from '@/lib/security/api-key-format';
import { verifySignedTokenIntegrity } from '@/lib/security/tokens';

const protectedPrefixes = [
  '/dealer', '/vendor', '/admin',
  '/api/vehicles', '/api/vin-analyses', '/api/crm', '/api/inventory', '/api/sales', '/api/copilot', '/api/analytics',
  '/api/billing', '/api/team', '/api/account'
];
const publicPaths = ['/', '/api/health'];

function authErrorResponse(message: string, status = 401) {
  return NextResponse.json({ ok: false, error: { code: 'AUTH_ERROR', message } }, { status });
}

/**
 * Edge-runtime gate: verifies the access-token cookie's HMAC signature
 * (cheap, no database access - Prisma cannot run in the Edge runtime).
 * This rejects missing/forged/tampered cookies fast. It cannot check
 * expiry or revocation (that requires a database lookup), so the
 * authoritative check still happens downstream via `getSession()` in
 * route handlers and server components (Node.js runtime).
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (publicPaths.includes(pathname)) return NextResponse.next();

  const protectedRoute = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!protectedRoute) return NextResponse.next();

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  let tokenId = await verifySignedTokenIntegrity(accessToken);

  // API keys are signed the same way as session tokens (see
  // lib/security/tokens.ts), just prefixed for display/recognition, so the
  // same cheap signature check admits a valid `Authorization: Bearer`
  // credential here. The database-backed checks (revoked/expired, and
  // which organization/role it maps to) still happen in getSession().
  if (!tokenId) {
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
    if (bearerToken?.startsWith(API_KEY_PREFIX)) {
      tokenId = await verifySignedTokenIntegrity(bearerToken.slice(API_KEY_PREFIX.length));
    }
  }

  if (!tokenId) {
    if (pathname.startsWith('/api/')) return authErrorResponse('Missing or invalid authentication token');
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dealer/:path*', '/vendor/:path*', '/admin/:path*',
    '/api/vehicles/:path*', '/api/vin-analyses/:path*', '/api/crm/:path*',
    '/api/inventory/:path*', '/api/sales/:path*', '/api/copilot/:path*', '/api/analytics/:path*',
    '/api/billing/:path*', '/api/team/:path*', '/api/account/:path*'
  ]
};
