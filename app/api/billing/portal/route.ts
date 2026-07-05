import { requireRoutePermission } from '@/lib/server/route-auth';
import { createBillingPortalSessionForOrg } from '@/lib/server/billing/portal-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('billing.write');
    requireCsrfToken(request);
    enforceRateLimit(request, `billing:portal:${auth.session.organizationId}`, 20, 60 * 60);
    const body = await request.json();
    const result = await createBillingPortalSessionForOrg(auth.session.organizationId, body);
    return ok(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
