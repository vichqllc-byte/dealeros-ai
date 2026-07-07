import { requireRoutePermission } from '@/lib/server/route-auth';
import { updateMembershipRoleForOrg } from '@/lib/server/role-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function PATCH(request: Request, { params }: { params: { membershipId: string } }) {
  try {
    const auth = await requireRoutePermission('roles.manage');
    const body = await request.json();
    const data = await updateMembershipRoleForOrg(auth.session.organizationId, params.membershipId, body);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
