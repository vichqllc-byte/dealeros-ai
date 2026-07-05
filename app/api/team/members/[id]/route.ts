import { requireRoutePermission } from '@/lib/server/route-auth';
import { updateMemberRoleForOrg, removeMemberFromOrg } from '@/lib/server/team/member-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('team.write');
    requireCsrfToken(request);
    enforceRateLimit(request, `team:members:update:${auth.session.organizationId}`, 60, 60 * 60);
    const body = await request.json();
    const member = await updateMemberRoleForOrg(auth.session.organizationId, auth.session.userId, params.id, body);
    return ok({ member });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('team.write');
    requireCsrfToken(request);
    enforceRateLimit(request, `team:members:remove:${auth.session.organizationId}`, 60, 60 * 60);
    const result = await removeMemberFromOrg(auth.session.organizationId, auth.session.userId, params.id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
