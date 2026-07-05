import { requireRoutePermission } from '@/lib/server/route-auth';
import { createTaskForOrg, listTasksForOrg } from '@/lib/server/crm/task-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';

export async function GET() {
  try {
    const auth = await requireRoutePermission('crm.read');
    const data = await listTasksForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('crm.write');
    requireCsrfToken(request);
    const body = await request.json();
    const data = await createTaskForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
