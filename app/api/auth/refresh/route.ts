import { AppError, handleRouteError, ok } from '@/lib/api/responses';
import { refreshSession } from '@/lib/server/auth-service';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';
import { REFRESH_TOKEN_COOKIE, setAuthCookies, getCookieFromRequest } from '@/lib/security/cookies';

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'auth:refresh', 30, 60 * 60);
    requireCsrfToken(request);

    const refreshToken = getCookieFromRequest(request, REFRESH_TOKEN_COOKIE);
    if (!refreshToken) throw new AppError('Missing refresh token', 401, 'INVALID_REFRESH_TOKEN');

    const result = await refreshSession(refreshToken, { userAgent: request.headers.get('user-agent') });

    const response = ok({ success: true });
    setAuthCookies(response, { accessToken: result.accessToken, refreshToken: result.refreshToken, rememberMe: result.rememberMe });
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
