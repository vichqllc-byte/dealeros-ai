import { handleRouteError, ok } from '@/lib/api/responses';
import { verifyEmailConfirmSchema } from '@/lib/validators/auth';
import { verifyEmail } from '@/lib/server/auth-service';
import { enforceRateLimit } from '@/lib/security/guards';

// Reached via a single-use token embedded in an emailed link (GET), so the
// token itself is the credential - CSRF (which protects ambient cookie
// auth) is not applicable here. Rate-limited to slow down token guessing.
export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'auth:verify-email:confirm', 20, 60 * 60);
    const token = new URL(request.url).searchParams.get('token') ?? '';
    const input = verifyEmailConfirmSchema.parse({ token });
    const result = await verifyEmail(input.token);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
