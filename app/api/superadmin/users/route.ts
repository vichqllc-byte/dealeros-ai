import { requireSuperAdmin } from '@/lib/server/route-auth';
import { listAllUsersOverview } from '@/lib/server/admin/platform-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    await requireSuperAdmin();
    const users = await listAllUsersOverview();
    return ok({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}
