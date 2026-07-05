import { handleRouteError, ok } from '@/lib/api/responses';
import { passwordResetConfirmSchema } from '@/lib/validators/auth';
import { resetPassword } from '@/lib/server/auth-service';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'auth:password-reset:confirm', 10, 60 * 60);
    requireCsrfToken(request);
    const body = await request.json();
    const input = passwordResetConfirmSchema.parse(body);
    const result = await resetPassword(input.token, input.newPassword);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
