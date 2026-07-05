import { requireRoutePermission } from '@/lib/server/route-auth';
import { updateListingForOrg } from '@/lib/server/inventory/listing-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('vehicles.write');
    requireCsrfToken(request);
    const body = await request.json();
    const data = await updateListingForOrg(auth.session.organizationId, auth.session.userId, params.id, body);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
