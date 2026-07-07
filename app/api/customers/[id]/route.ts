import { requireRoutePermission } from '@/lib/server/route-auth';
import { updateCustomerForOrg } from '@/lib/server/customer-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('customers.write');
    const body = await request.json();
    const data = await updateCustomerForOrg(auth.session.organizationId, auth.session.userId, params.id, body);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
