import { requireRoutePermission } from '@/lib/server/route-auth';
import { getSaleForOrg, updateSaleForOrg } from '@/lib/server/sales/sale-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('sales.read');
    const data = await getSaleForOrg(auth.session.organizationId, params.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('sales.write');
    requireCsrfToken(request);
    const body = await request.json();
    const data = await updateSaleForOrg(auth.session.organizationId, auth.session.userId, params.id, body);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
