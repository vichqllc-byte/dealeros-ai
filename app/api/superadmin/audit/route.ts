import { requireSuperAdmin } from '@/lib/server/route-auth';
import { listSuperAdminAuditLog } from '@/lib/server/admin/super-admin-audit-log';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    await requireSuperAdmin();
    const auditLog = await listSuperAdminAuditLog();
    return ok({ auditLog });
  } catch (error) {
    return handleRouteError(error);
  }
}
