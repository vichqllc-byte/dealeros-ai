import { requireSuperAdmin } from '@/lib/server/route-auth';
import { getSystemHealth } from '@/lib/server/admin/system-health-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    await requireSuperAdmin();
    const health = await getSystemHealth();
    return ok({ health });
  } catch (error) {
    return handleRouteError(error);
  }
}
