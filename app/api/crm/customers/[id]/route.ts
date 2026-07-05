import { requireRoutePermission } from '@/lib/server/route-auth';
import { deleteCustomerForOrg, getCustomerForOrg, updateCustomerForOrg } from '@/lib/server/crm/customer-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('crm.read');
    const data = await getCustomerForOrg(auth.session.organizationId, params.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('crm.write');
    const body = await request.json();
    const data = await updateCustomerForOrg(auth.session.organizationId, auth.session.userId, params.id, body);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('crm.write');
    const data = await deleteCustomerForOrg(auth.session.organizationId, auth.session.userId, params.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
