import { requireSuperAdmin } from '@/lib/server/route-auth';
import { listFeatureFlags, setFeatureFlag } from '@/lib/server/admin/feature-flag-service';
import { setFeatureFlagSchema } from '@/lib/validators/admin';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function GET() {
  try {
    await requireSuperAdmin();
    const flags = await listFeatureFlags();
    return ok({ flags });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSuperAdmin();
    requireCsrfToken(request);
    enforceRateLimit(request, `superadmin:feature-flags:${auth.session.userId}`, 60, 60 * 60);
    const body = await request.json();
    const input = setFeatureFlagSchema.parse(body);
    const flag = await setFeatureFlag(auth.session.userId, input.key, input.enabled, input.description);
    return ok({ flag });
  } catch (error) {
    return handleRouteError(error);
  }
}
