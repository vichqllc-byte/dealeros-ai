import { requireRoutePermission } from '@/lib/server/route-auth';
import { deleteVehicleForOrg, updateVehicleForOrg } from '@/lib/server/vehicle-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('vehicles.write');
    const body = await request.json();
    const data = await updateVehicleForOrg(auth.session.organizationId, auth.session.userId, params.id, body);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('vehicles.write');
    const data = await deleteVehicleForOrg(auth.session.organizationId, auth.session.userId, params.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
