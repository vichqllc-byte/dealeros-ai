import { requireSession } from '@/lib/server/route-auth';
import { getNotificationPreferenceForUser, updateNotificationPreferenceForUser } from '@/lib/server/notifications/notification-preference-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function GET() {
  try {
    const auth = await requireSession();
    const preference = await getNotificationPreferenceForUser(auth.session.userId);
    return ok({ preference });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    requireCsrfToken(request);
    enforceRateLimit(request, `account:notifications:preferences:${auth.session.userId}`, 60, 60 * 60);
    const body = await request.json();
    const preference = await updateNotificationPreferenceForUser(auth.session.userId, body);
    return ok({ preference });
  } catch (error) {
    return handleRouteError(error);
  }
}
