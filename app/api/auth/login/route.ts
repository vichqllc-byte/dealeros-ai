import { handleRouteError, ok } from '@/lib/api/responses';
import { loginSchema } from '@/lib/validators/auth';
import { authenticateUser } from '@/lib/server/auth-service';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';
import { getClientIp } from '@/lib/security/rate-limit';
import { setAuthCookies } from '@/lib/security/cookies';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);

    // Rate-limit by IP and by the submitted email independently so
    // credential-stuffing against one account from many IPs is also capped.
    enforceRateLimit(request, 'auth:login:ip', 20, 15 * 60);
    enforceRateLimit(request, `auth:login:email:${input.email.toLowerCase()}`, 10, 15 * 60);
    requireCsrfToken(request);

    const result = await authenticateUser(input.email, input.password, input.rememberMe, {
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent')
    });

    const response = ok({ user: result.user });
    setAuthCookies(response, { accessToken: result.accessToken, refreshToken: result.refreshToken, rememberMe: result.rememberMe });
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
