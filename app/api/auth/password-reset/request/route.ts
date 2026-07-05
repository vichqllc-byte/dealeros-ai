import { handleRouteError, ok } from '@/lib/api/responses';
import { passwordResetRequestSchema } from '@/lib/validators/auth';
import { requestPasswordReset } from '@/lib/server/auth-service';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'auth:password-reset:request', 5, 60 * 60);
    requireCsrfToken(request);
    const body = await request.json();
    const input = passwordResetRequestSchema.parse(body);
    const result = await requestPasswordReset(input.email);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
