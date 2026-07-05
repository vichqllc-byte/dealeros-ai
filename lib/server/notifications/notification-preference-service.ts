import { db } from '@/lib/db/client';
import { updateNotificationPreferenceSchema } from '@/lib/validators/notifications';

export async function getNotificationPreferenceForUser(userId: string) {
  const existing = await db.notificationPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.notificationPreference.create({ data: { userId } });
}

export async function updateNotificationPreferenceForUser(userId: string, payload: unknown) {
  const input = updateNotificationPreferenceSchema.parse(payload);
  await getNotificationPreferenceForUser(userId);
  return db.notificationPreference.update({ where: { userId }, data: input });
}
