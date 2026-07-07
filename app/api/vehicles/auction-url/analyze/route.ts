import { requireRoutePermission } from '@/lib/server/route-auth';
import { runAuctionUrlVehicleFlowForOrg } from '@/lib/server/vehicle-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.write');
    requireCsrfToken(request);
    const body = await request.json();
    const data = await runAuctionUrlVehicleFlowForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
