import { requireRoutePermission } from '@/lib/server/route-auth';
import { getInventoryAnalyticsForOrg } from '@/lib/server/inventory/inventory-analytics-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const data = await getInventoryAnalyticsForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
