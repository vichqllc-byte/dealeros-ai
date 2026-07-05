import { requireRoutePermission } from '@/lib/server/route-auth';
import { deleteLeadForOrg, updateLeadForOrg } from '@/lib/server/crm/lead-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('crm.write');
    requireCsrfToken(request);
    const body = await request.json();
    const data = await updateLeadForOrg(auth.session.organizationId, auth.session.userId, params.id, body);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('crm.write');
    requireCsrfToken(request);
    const data = await deleteLeadForOrg(auth.session.organizationId, auth.session.userId, params.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
