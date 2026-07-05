import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPrefixes = ['/dealer', '/vendor', '/admin', '/api/vehicles', '/api/vin-analyses'];
const publicPaths = ['/', '/api/health'];

function authErrorResponse(message: string, status = 401) {
  return NextResponse.json({ ok: false, error: { code: 'AUTH_ERROR', message } }, { status });
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (publicPaths.includes(pathname)) return NextResponse.next();

  const protectedRoute = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (!protectedRoute) return NextResponse.next();

  const accessToken = request.cookies.get('sb-access-token')?.value;
  const refreshToken = request.cookies.get('sb-refresh-token')?.value;

  if (!accessToken) {
    if (pathname.startsWith('/api/')) return authErrorResponse('Missing authentication token');
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (accessToken === 'expired' && !refreshToken) {
    if (pathname.startsWith('/api/')) return authErrorResponse('Expired authentication token');
    return NextResponse.redirect(new URL('/?reason=expired', request.url));
  }

  if (accessToken === 'invalid') {
    if (pathname.startsWith('/api/')) return authErrorResponse('Invalid authentication token');
    return NextResponse.redirect(new URL('/?reason=invalid', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dealer/:path*', '/vendor/:path*', '/admin/:path*', '/api/vehicles/:path*', '/api/vin-analyses/:path*']
};
