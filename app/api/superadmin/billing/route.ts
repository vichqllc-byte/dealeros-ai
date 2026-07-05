import { requireSuperAdmin } from '@/lib/server/route-auth';
import { getBillingOverview } from '@/lib/server/admin/platform-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    await requireSuperAdmin();
    const billing = await getBillingOverview();
    return ok({ billing });
  } catch (error) {
    return handleRouteError(error);
  }
}
