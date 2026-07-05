import { requireRoutePermission } from '@/lib/server/route-auth';
import { deleteEmailTemplateForOrg, updateEmailTemplateForOrg } from '@/lib/server/crm/email-template-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('crm.write');
    const body = await request.json();
    const data = await updateEmailTemplateForOrg(auth.session.organizationId, auth.session.userId, params.id, body);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('crm.write');
    const data = await deleteEmailTemplateForOrg(auth.session.organizationId, auth.session.userId, params.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
