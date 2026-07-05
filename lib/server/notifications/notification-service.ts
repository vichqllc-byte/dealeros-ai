import { db } from '@/lib/db/client';
import { AppError } from '@/lib/api/responses';
import { sendEmail } from '@/lib/email/mailer';
import { getNotificationPreferenceForUser } from '@/lib/server/notifications/notification-preference-service';

export type NotifyUserInput = {
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  body: string;
  link?: string;
};

/**
 * Always records an in-app notification (the notification center is the
 * one channel every user account has by definition), then additionally
 * emails the user if their preference allows it. The smsEnabled/pushEnabled
 * preferences are stored for forward-compatibility but not dispatched
 * here yet - User doesn't carry a phone number or push device token to
 * send to, and fabricating one would violate the same honesty rule
 * already applied to premium VIN-intelligence data providers. Once those
 * fields exist, lib/sms/sms-provider.ts and lib/push/push-provider.ts are
 * already real, ready transports.
 */
export async function notifyUser(organizationId: string, userId: string, input: NotifyUserInput) {
  const notification = await db.notification.create({
    data: {
      organizationId,
      userId,
      type: input.type ?? 'INFO',
      title: input.title,
      body: input.body,
      link: input.link
    }
  });

  const preference = await getNotificationPreferenceForUser(userId);
  if (preference.emailEnabled) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user) {
      await sendEmail({ to: user.email, subject: input.title, text: input.body });
    }
  }

  return notification;
}

export async function listNotificationsForUser(organizationId: string, userId: string, unreadOnly = false) {
  return db.notification.findMany({
    where: { organizationId, userId, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' }
  });
}

export async function countUnreadNotificationsForUser(organizationId: string, userId: string) {
  return db.notification.count({ where: { organizationId, userId, readAt: null } });
}

export async function markNotificationRead(organizationId: string, userId: string, id: string) {
  const existing = await db.notification.findFirst({ where: { id, organizationId, userId } });
  if (!existing) throw new AppError('Notification not found', 404, 'NOT_FOUND');

  await db.notification.updateMany({ where: { id, organizationId, userId, readAt: null }, data: { readAt: new Date() } });
  return db.notification.findFirstOrThrow({ where: { id, organizationId, userId } });
}

export async function markAllNotificationsRead(organizationId: string, userId: string) {
  const { count } = await db.notification.updateMany({ where: { organizationId, userId, readAt: null }, data: { readAt: new Date() } });
  return { updated: count };
}
