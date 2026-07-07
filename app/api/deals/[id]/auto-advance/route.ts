import { requireRoutePermission } from '@/lib/server/route-auth';
import { autoAdvanceDealForOrg } from '@/lib/server/deal-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('deals.write');
    const data = await autoAdvanceDealForOrg(auth.session.organizationId, auth.session.userId, params.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
