import { requireSession } from '@/lib/server/route-auth';
import { revokeSessionForUser } from '@/lib/server/account/session-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit, requireCsrfToken } from '@/lib/security/guards';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireSession();
    requireCsrfToken(request);
    enforceRateLimit(request, `account:sessions:revoke:${auth.session.userId}`, 60, 60 * 60);
    const result = await revokeSessionForUser(auth.session.userId, params.id);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
