import { requireSession } from '@/lib/server/route-auth';
import { markAllNotificationsRead } from '@/lib/server/notifications/notification-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    requireCsrfToken(request);
    enforceRateLimit(request, `account:notifications:read-all:${auth.session.userId}`, 60, 60 * 60);
    const result = await markAllNotificationsRead(auth.session.organizationId, auth.session.userId);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
