import { requireRoutePermission } from '@/lib/server/route-auth';
import { getAnalyticsForOrg } from '@/lib/server/analytics-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('analytics.read');
    const data = await getAnalyticsForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
