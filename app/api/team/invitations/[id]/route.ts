import { requireRoutePermission } from '@/lib/server/route-auth';
import { revokeInvitationForOrg } from '@/lib/server/team/invitation-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('team.write');
    requireCsrfToken(request);
    enforceRateLimit(request, `team:invitations:revoke:${auth.session.organizationId}`, 60, 60 * 60);
    const result = await revokeInvitationForOrg(auth.session.organizationId, auth.session.userId, params.id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
