import { requireRoutePermission } from '@/lib/server/route-auth';
import { listCommunicationsForOrg, logCommunicationForOrg } from '@/lib/server/crm/communication-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('crm.read');
    const data = await listCommunicationsForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('crm.write');
    const body = await request.json();
    const data = await logCommunicationForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
