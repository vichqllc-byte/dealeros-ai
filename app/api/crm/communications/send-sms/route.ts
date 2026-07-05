import { requireRoutePermission } from '@/lib/server/route-auth';
import { sendSmsForOrg } from '@/lib/server/crm/communication-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit } from '@/lib/security/guards';

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('crm.write');
    enforceRateLimit(request, `crm:send-sms:${auth.session.organizationId}`, 60, 60 * 60);
    const body = await request.json();
    const data = await sendSmsForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
