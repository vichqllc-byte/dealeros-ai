import type { NextResponse } from 'next/server';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const CSRF_TOKEN_COOKIE = 'csrf_token';

export const ACCESS_TOKEN_TTL_MINUTES = 15;
export const REFRESH_TOKEN_TTL_DAYS_DEFAULT = 1;
export const REFRESH_TOKEN_TTL_DAYS_REMEMBER_ME = 30;

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/'
  };
}

export function setAuthCookies(
  response: NextResponse,
  params: { accessToken: string; refreshToken: string; rememberMe: boolean }
) {
  const refreshTtlDays = params.rememberMe ? REFRESH_TOKEN_TTL_DAYS_REMEMBER_ME : REFRESH_TOKEN_TTL_DAYS_DEFAULT;

  response.cookies.set(ACCESS_TOKEN_COOKIE, params.accessToken, {
    ...baseCookieOptions(),
    maxAge: ACCESS_TOKEN_TTL_MINUTES * 60
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, params.refreshToken, {
    ...baseCookieOptions(),
    // Omitting maxAge for non-remember-me sessions yields a browser session
    // cookie; server-side expiry is still authoritatively enforced via the
    // Session row's refreshExpiresAt regardless of cookie lifetime.
    ...(params.rememberMe ? { maxAge: refreshTtlDays * 24 * 60 * 60 } : {})
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', { ...baseCookieOptions(), maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', { ...baseCookieOptions(), maxAge: 0 });
}

/**
 * Reads a cookie directly off the incoming `Request`. Route Handlers that
 * receive `request` should use this rather than `next/headers`'s `cookies()`,
 * which requires Next's request-scoped context and cannot be exercised by
 * invoking a route handler function directly (e.g. in unit tests).
 */
export function getCookieFromRequest(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1];
}
