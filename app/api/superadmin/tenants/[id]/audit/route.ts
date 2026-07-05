import { requireSuperAdmin } from '@/lib/server/route-auth';
import { db } from '@/lib/db/client';
import { handleRouteError, ok } from '@/lib/api/responses';

// Deliberately superadmin-only: viewing another org's audit log is a
// platform-operations capability, distinct from the per-org
// `audit.read` permission (see lib/rbac/permissions.ts), which stays
// scoped to a user's own organization per the Phase 3 isolation fix.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
    const auditLog = await db.auditLog.findMany({ where: { organizationId: params.id }, orderBy: { createdAt: 'desc' }, take: 200 });
    return ok({ auditLog });
  } catch (error) {
    return handleRouteError(error);
  }
}
