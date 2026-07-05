import { requireRoutePermission } from '@/lib/server/route-auth';
import { createApiKeyForOrg, listApiKeysForOrg } from '@/lib/server/team/api-key-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function GET() {
  try {
    const auth = await requireRoutePermission('team.write');
    const apiKeys = await listApiKeysForOrg(auth.session.organizationId);
    return ok({ apiKeys });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('team.write');
    requireCsrfToken(request);
    enforceRateLimit(request, `team:api-keys:create:${auth.session.organizationId}`, 20, 60 * 60);
    const body = await request.json();
    const apiKey = await createApiKeyForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok({ apiKey }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
