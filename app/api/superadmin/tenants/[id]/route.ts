import { requireSuperAdmin } from '@/lib/server/route-auth';
import { getTenantDetail } from '@/lib/server/admin/platform-service';
import { handleRouteError, ok, AppError } from '@/lib/api/responses';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
    const tenant = await getTenantDetail(params.id);
    if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');
    return ok({ tenant });
  } catch (error) {
    return handleRouteError(error);
  }
}
