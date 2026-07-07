import { requireRoutePermission } from '@/lib/server/route-auth';
import { listMembershipsForOrg } from '@/lib/server/role-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('roles.manage');
    const data = await listMembershipsForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
