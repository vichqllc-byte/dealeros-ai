import { requireSession } from '@/lib/server/route-auth';
import { listNotificationsForUser, countUnreadNotificationsForUser } from '@/lib/server/notifications/notification-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    const unreadOnly = new URL(request.url).searchParams.get('unread') === 'true';
    const [notifications, unreadCount] = await Promise.all([
      listNotificationsForUser(auth.session.organizationId, auth.session.userId, unreadOnly),
      countUnreadNotificationsForUser(auth.session.organizationId, auth.session.userId)
    ]);
    return ok({ notifications, unreadCount });
  } catch (error) {
    return handleRouteError(error);
  }
}
