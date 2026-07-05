import { handleRouteError, ok } from '@/lib/api/responses';
import { registerSchema } from '@/lib/validators/auth';
import { registerUser } from '@/lib/server/auth-service';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'auth:register', 10, 60 * 60);
    requireCsrfToken(request);
    const body = await request.json();
    const input = registerSchema.parse(body);
    const result = await registerUser(input);
    return ok(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
