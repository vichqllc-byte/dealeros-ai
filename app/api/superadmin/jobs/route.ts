import { requireSuperAdmin } from '@/lib/server/route-auth';
import { db } from '@/lib/db/client';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    await requireSuperAdmin();
    const [recentJobs, byStatus] = await Promise.all([
      db.job.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      db.job.groupBy({ by: ['status'], _count: { _all: true } })
    ]);
    return ok({ recentJobs, byStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })) });
  } catch (error) {
    return handleRouteError(error);
  }
}
