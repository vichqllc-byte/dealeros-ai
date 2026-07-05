import { requireSuperAdmin } from '@/lib/server/route-auth';
import { getProviderStatus } from '@/lib/server/admin/system-health-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    await requireSuperAdmin();
    const providers = await getProviderStatus();
    return ok({ providers });
  } catch (error) {
    return handleRouteError(error);
  }
}
