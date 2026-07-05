import { requireRoutePermission } from '@/lib/server/route-auth';
import { recordUsageForOrg, listUsageForOrg } from '@/lib/server/billing/usage-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireRoutePermission('billing.read');
    const metric = new URL(request.url).searchParams.get('metric') ?? undefined;
    const usage = await listUsageForOrg(auth.session.organizationId, metric);
    return ok({ usage });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('billing.write');
    requireCsrfToken(request);
    enforceRateLimit(request, `billing:usage:${auth.session.organizationId}`, 200, 60 * 60);
    const body = await request.json();
    const usage = await recordUsageForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok({ usage }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
