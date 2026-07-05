import { handleRouteError, ok } from '@/lib/api/responses';
import { resendVerificationSchema } from '@/lib/validators/auth';
import { requestEmailVerification } from '@/lib/server/auth-service';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'auth:verify-email:request', 5, 60 * 60);
    requireCsrfToken(request);
    const body = await request.json();
    const input = resendVerificationSchema.parse(body);
    const result = await requestEmailVerification(input.email);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
