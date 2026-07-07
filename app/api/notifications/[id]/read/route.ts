import { requireRoutePermission } from '@/lib/server/route-auth';
import { markNotificationReadForOrg } from '@/lib/server/notification-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('notifications.write');
    const data = await markNotificationReadForOrg(auth.session.organizationId, params.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
