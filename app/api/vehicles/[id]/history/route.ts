import { requireRoutePermission } from '@/lib/server/route-auth';
import { getVehicleHistoryReport } from '@/lib/server/vehicle-history-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const history = await getVehicleHistoryReport(auth.session.organizationId, params.id);
    return ok(history);
  } catch (error) {
    return handleRouteError(error);
  }
}
