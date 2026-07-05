import { requireRoutePermission } from '@/lib/server/route-auth';
import { handleRouteError, ok } from '@/lib/api/responses';
import { db } from '@/lib/db/client';

export async function GET() {
  try {
    const auth = await requireRoutePermission('audit.read');
    const [vehicleCount, analyzedCount, activityCount, auditCount] = await Promise.all([
      db.vehicle.count({ where: { organizationId: auth.session.organizationId } }),
      db.vehicle.count({ where: { organizationId: auth.session.organizationId, status: 'ANALYZED' } }),
      db.activityLog.count({ where: { organizationId: auth.session.organizationId } }),
      db.auditLog.count({ where: { organizationId: auth.session.organizationId } })
    ]);

    return ok({ vehicleCount, analyzedCount, activityCount, auditCount });
  } catch (error) {
    return handleRouteError(error);
  }
}
