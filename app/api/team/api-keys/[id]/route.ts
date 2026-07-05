import { requireRoutePermission } from '@/lib/server/route-auth';
import { revokeApiKeyForOrg } from '@/lib/server/team/api-key-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('team.write');
    requireCsrfToken(request);
    enforceRateLimit(request, `team:api-keys:revoke:${auth.session.organizationId}`, 60, 60 * 60);
    const result = await revokeApiKeyForOrg(auth.session.organizationId, auth.session.userId, params.id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
