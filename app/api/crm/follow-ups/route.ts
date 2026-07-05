import { requireRoutePermission } from '@/lib/server/route-auth';
import { listDueFollowUpsForOrg } from '@/lib/server/crm/lead-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('crm.read');
    const data = await listDueFollowUpsForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
