import { requireRoutePermission } from '@/lib/server/route-auth';
import { getDealerAnalyticsForOrg } from '@/lib/server/analytics/analytics-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const windowParam = new URL(request.url).searchParams.get('windowDays');
    const windowDays = windowParam ? Number(windowParam) : undefined;
    const data = await getDealerAnalyticsForOrg(auth.session.organizationId, windowDays);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
