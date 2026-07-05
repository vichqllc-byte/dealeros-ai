import { requireSuperAdmin } from '@/lib/server/route-auth';
import { listTenantsOverview } from '@/lib/server/admin/platform-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    await requireSuperAdmin();
    const tenants = await listTenantsOverview();
    return ok({ tenants });
  } catch (error) {
    return handleRouteError(error);
  }
}
