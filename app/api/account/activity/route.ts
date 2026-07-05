import { requireSession } from '@/lib/server/route-auth';
import { listRecentActivityForUser } from '@/lib/server/account/activity-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireSession();
    const activity = await listRecentActivityForUser(auth.session.organizationId, auth.session.userId);
    return ok({ activity });
  } catch (error) {
    return handleRouteError(error);
  }
}
