import { requireRoutePermission } from '@/lib/server/route-auth';
import { createDealForOrg, listDealsForOrg } from '@/lib/server/deal-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('deals.read');
    const data = await listDealsForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('deals.write');
    const body = await request.json();
    const data = await createDealForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
