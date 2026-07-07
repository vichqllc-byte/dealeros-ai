import { requireRoutePermission } from '@/lib/server/route-auth';
import { createNotificationForOrg, listNotificationsForOrg } from '@/lib/server/notification-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('notifications.read');
    const data = await listNotificationsForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('notifications.write');
    const body = await request.json();
    const data = await createNotificationForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
