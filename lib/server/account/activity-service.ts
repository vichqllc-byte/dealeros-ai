import { db } from '@/lib/db/client';

export async function listRecentActivityForUser(organizationId: string, userId: string, limit = 50) {
  return db.activityLog.findMany({
    where: { organizationId, actorUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}
