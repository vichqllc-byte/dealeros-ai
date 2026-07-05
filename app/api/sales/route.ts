import { requireRoutePermission } from '@/lib/server/route-auth';
import { createSaleForOrg, listSalesForOrg } from '@/lib/server/sales/sale-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';

export async function GET() {
  try {
    const auth = await requireRoutePermission('sales.read');
    const data = await listSalesForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('sales.write');
    requireCsrfToken(request);
    const body = await request.json();
    const data = await createSaleForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
