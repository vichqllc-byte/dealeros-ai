import { requireRoutePermission } from '@/lib/server/route-auth';
import { createPriceRecordForOrg, listPriceRecordsForOrg } from '@/lib/server/inventory/pricing-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const vehicleId = new URL(request.url).searchParams.get('vehicleId') ?? undefined;
    const data = await listPriceRecordsForOrg(auth.session.organizationId, vehicleId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.write');
    requireCsrfToken(request);
    const body = await request.json();
    const data = await createPriceRecordForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
