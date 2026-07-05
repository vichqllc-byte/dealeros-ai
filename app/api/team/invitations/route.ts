import { requireRoutePermission } from '@/lib/server/route-auth';
import { inviteMemberToOrg, listInvitationsForOrg } from '@/lib/server/team/invitation-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function GET() {
  try {
    const auth = await requireRoutePermission('team.read');
    const invitations = await listInvitationsForOrg(auth.session.organizationId);
    return ok({ invitations });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('team.write');
    requireCsrfToken(request);
    enforceRateLimit(request, `team:invitations:create:${auth.session.organizationId}`, 30, 60 * 60);
    const body = await request.json();
    const invitation = await inviteMemberToOrg(auth.session.organizationId, auth.session.userId, body);
    return ok({ invitation }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
