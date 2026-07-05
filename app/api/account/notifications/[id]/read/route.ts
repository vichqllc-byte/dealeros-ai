import { requireSession } from '@/lib/server/route-auth';
import { markNotificationRead } from '@/lib/server/notifications/notification-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireSession();
    requireCsrfToken(request);
    enforceRateLimit(request, `account:notifications:read:${auth.session.userId}`, 300, 60 * 60);
    const notification = await markNotificationRead(auth.session.organizationId, auth.session.userId, params.id);
    return ok({ notification });
  } catch (error) {
    return handleRouteError(error);
  }
}
