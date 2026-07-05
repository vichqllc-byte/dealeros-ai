import { requireSession } from '@/lib/server/route-auth';
import { listSessionsForUser } from '@/lib/server/account/session-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireSession();
    const sessions = await listSessionsForUser(auth.session.userId, auth.session.sessionId);
    return ok({ sessions });
  } catch (error) {
    return handleRouteError(error);
  }
}
