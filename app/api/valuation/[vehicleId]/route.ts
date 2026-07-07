import { requireRoutePermission } from '@/lib/server/route-auth';
import { getVehicleValuationForOrg } from '@/lib/server/valuation-service';
import { handleRouteError, ok, notFound } from '@/lib/api/responses';

export async function GET(_request: Request, { params }: { params: { vehicleId: string } }) {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const data = await getVehicleValuationForOrg(auth.session.organizationId, params.vehicleId);
    if (!data) return notFound('Vehicle not found');
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
