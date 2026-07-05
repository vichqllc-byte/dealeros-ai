import { requireRoutePermission } from '@/lib/server/route-auth';
import { createCheckoutSessionForOrg } from '@/lib/server/billing/checkout-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('billing.write');
    requireCsrfToken(request);
    enforceRateLimit(request, `billing:checkout:${auth.session.organizationId}`, 10, 60 * 60);
    const body = await request.json();
    const result = await createCheckoutSessionForOrg(auth.session.organizationId, auth.session.userId, auth.session.email, body);
    return ok(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
