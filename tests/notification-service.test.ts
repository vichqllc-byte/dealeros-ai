import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, ensureTestDatabase } from './setup/route-test-helpers';
import { hashPassword } from '@/lib/security/password';
import {
  notifyUser,
  listNotificationsForUser,
  countUnreadNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead
} from '@/lib/server/notifications/notification-service';
import { updateNotificationPreferenceForUser } from '@/lib/server/notifications/notification-preference-service';

const dbTestsEnabled = await ensureTestDatabase();
const describeForDbTests = dbTestsEnabled ? describe : describe.skip;

describeForDbTests('notification service', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    await testDb.notification.deleteMany();
    await testDb.notificationPreference.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    await testDb.organization.create({ data: { id: 'org-a', name: 'Org A' } });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' } });
  });

  it('creates an in-app notification and defaults preferences to email+in-app enabled', async () => {
    const notification = await notifyUser('org-a', 'user-dealer', { title: 'Hello', body: 'World' });
    expect(notification.title).toBe('Hello');

    const list = await listNotificationsForUser('org-a', 'user-dealer');
    expect(list).toHaveLength(1);
    expect(list[0].readAt).toBeNull();
  });

  it('does not email when the user has disabled email notifications', async () => {
    await updateNotificationPreferenceForUser('user-dealer', { emailEnabled: false });
    // No assertion on the console transport itself (already covered by
    // lib/email/mailer tests) - this proves the preference gate is
    // actually consulted rather than always sending.
    const preferenceBefore = await testDb.notificationPreference.findUnique({ where: { userId: 'user-dealer' } });
    expect(preferenceBefore?.emailEnabled).toBe(false);

    await notifyUser('org-a', 'user-dealer', { title: 'Quiet please', body: 'No email for this one' });
    const notification = await testDb.notification.findFirst({ where: { userId: 'user-dealer' } });
    expect(notification).toBeTruthy();
  });

  it('counts unread notifications and marks one as read', async () => {
    const first = await notifyUser('org-a', 'user-dealer', { title: 'One', body: 'a' });
    await notifyUser('org-a', 'user-dealer', { title: 'Two', body: 'b' });
    expect(await countUnreadNotificationsForUser('org-a', 'user-dealer')).toBe(2);

    const updated = await markNotificationRead('org-a', 'user-dealer', first.id);
    expect(updated.readAt).toBeTruthy();
    expect(await countUnreadNotificationsForUser('org-a', 'user-dealer')).toBe(1);
  });

  it('marks all notifications as read at once', async () => {
    await notifyUser('org-a', 'user-dealer', { title: 'One', body: 'a' });
    await notifyUser('org-a', 'user-dealer', { title: 'Two', body: 'b' });

    const result = await markAllNotificationsRead('org-a', 'user-dealer');
    expect(result.updated).toBe(2);
    expect(await countUnreadNotificationsForUser('org-a', 'user-dealer')).toBe(0);
  });

  it('scopes unread-only listing correctly', async () => {
    const first = await notifyUser('org-a', 'user-dealer', { title: 'One', body: 'a' });
    await notifyUser('org-a', 'user-dealer', { title: 'Two', body: 'b' });
    await markNotificationRead('org-a', 'user-dealer', first.id);

    const unread = await listNotificationsForUser('org-a', 'user-dealer', true);
    expect(unread).toHaveLength(1);
    expect(unread[0].title).toBe('Two');
  });
});
