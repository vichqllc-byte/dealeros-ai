import { handleRouteError, ok } from '@/lib/api/responses';
import { revokeSessionByAccessToken } from '@/lib/server/auth-service';
import { requireCsrfToken } from '@/lib/security/guards';
import { ACCESS_TOKEN_COOKIE, clearAuthCookies, getCookieFromRequest } from '@/lib/security/cookies';

export async function POST(request: Request) {
  try {
    requireCsrfToken(request);
    const accessToken = getCookieFromRequest(request, ACCESS_TOKEN_COOKIE);
    await revokeSessionByAccessToken(accessToken);

    const response = ok({ success: true });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
