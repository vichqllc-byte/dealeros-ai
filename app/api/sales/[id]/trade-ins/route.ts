import { requireRoutePermission } from '@/lib/server/route-auth';
import { createTradeInForSale, listTradeInsForSale } from '@/lib/server/sales/trade-in-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('sales.read');
    const data = await listTradeInsForSale(auth.session.organizationId, params.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('sales.write');
    requireCsrfToken(request);
    const body = await request.json();
    const data = await createTradeInForSale(auth.session.organizationId, auth.session.userId, params.id, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
