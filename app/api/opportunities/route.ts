import { requireRoutePermission } from '@/lib/server/route-auth';
import { listOpportunitySummariesForOrg } from '@/lib/server/opportunity-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const data = await listOpportunitySummariesForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
