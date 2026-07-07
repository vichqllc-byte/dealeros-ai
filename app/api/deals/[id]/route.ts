import { requireRoutePermission } from '@/lib/server/route-auth';
import { updateDealForOrg } from '@/lib/server/deal-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('deals.write');
    const body = await request.json();
    const data = await updateDealForOrg(auth.session.organizationId, auth.session.userId, params.id, body);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
