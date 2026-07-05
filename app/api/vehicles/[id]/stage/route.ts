import { requireRoutePermission } from '@/lib/server/route-auth';
import { transitionVehicleStage } from '@/lib/server/inventory/inventory-workflow-service';
import { transitionStageSchema } from '@/lib/validators/inventory';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('vehicles.write');
    requireCsrfToken(request);
    const body = await request.json();
    const { toStage } = transitionStageSchema.parse(body);
    const data = await transitionVehicleStage(auth.session.organizationId, auth.session.userId, params.id, toStage);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
