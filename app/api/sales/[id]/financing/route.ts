import { requireRoutePermission } from '@/lib/server/route-auth';
import { createFinancingApplicationForSale, listFinancingApplicationsForSale } from '@/lib/server/sales/financing-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('sales.read');
    const data = await listFinancingApplicationsForSale(auth.session.organizationId, params.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('sales.write');
    const body = await request.json();
    const data = await createFinancingApplicationForSale(auth.session.organizationId, auth.session.userId, params.id, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
