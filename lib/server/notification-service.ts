import { db } from '@/lib/db/client';
import { createNotificationSchema } from '@/lib/validators/notification';
import { AppError } from '@/lib/api/responses';

export async function listNotificationsForOrg(organizationId: string) {
  return db.notification.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
}

export async function createNotificationForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createNotificationSchema.parse(payload);
  return db.notification.create({
    data: {
      organizationId,
      actorUserId,
      channel: input.channel ?? 'IN_APP',
      status: input.channel === 'EMAIL' ? 'SENT' : 'PENDING',
      title: input.title,
      message: input.message,
      metadata: input.metadata,
      sentAt: input.channel === 'EMAIL' ? new Date() : null
    }
  });
}

export async function markNotificationReadForOrg(organizationId: string, id: string) {
  const existing = await db.notification.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Notification not found', 404, 'NOT_FOUND');
  return db.notification.update({
    where: { id },
    data: {
      status: 'READ',
      readAt: new Date()
    }
  });
}
