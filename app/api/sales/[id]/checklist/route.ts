import { requireRoutePermission } from '@/lib/server/route-auth';
import { updateDeliveryChecklistItemForOrg } from '@/lib/server/sales/sale-service';
import { updateDeliveryChecklistSchema } from '@/lib/validators/sales';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('sales.write');
    const body = await request.json();
    const { itemId, completed } = updateDeliveryChecklistSchema.parse(body);
    const data = await updateDeliveryChecklistItemForOrg(auth.session.organizationId, auth.session.userId, params.id, itemId, completed);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
