import { requireRoutePermission } from '@/lib/server/route-auth';
import { createAppointmentForOrg, listAppointmentsForOrg } from '@/lib/server/crm/appointment-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('crm.read');
    const data = await listAppointmentsForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('crm.write');
    const body = await request.json();
    const data = await createAppointmentForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
