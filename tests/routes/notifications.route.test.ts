import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('notification routes', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    resetAuth();
    await testDb.notification.deleteMany();
    await testDb.notificationPreference.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.task.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    await testDb.organization.create({ data: { id: 'org-a', name: 'Org A' } });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' } });
    useSession(authMocks.dealer);
  });

  it('lists notifications and unread count', async () => {
    await testDb.notification.create({ data: { organizationId: 'org-a', userId: 'user-dealer', title: 'Hi', body: 'there' } });
    const { GET } = await import('../../app/api/account/notifications/route');
    const res = await GET(new Request('http://localhost/test'));
    const body = await jsonBody(res);
    expect(body.data.notifications).toHaveLength(1);
    expect(body.data.unreadCount).toBe(1);
  });

  it('marks a single notification as read', async () => {
    const notification = await testDb.notification.create({ data: { organizationId: 'org-a', userId: 'user-dealer', title: 'Hi', body: 'there' } });
    const { POST } = await import('../../app/api/account/notifications/[id]/read/route');
    const res = await POST(jsonRequest('POST'), { params: { id: notification.id } });
    expect(res.status).toBe(200);
    expect((await jsonBody(res)).data.notification.readAt).toBeTruthy();
  });

  it('marks all notifications as read', async () => {
    await testDb.notification.createMany({
      data: [
        { organizationId: 'org-a', userId: 'user-dealer', title: 'A', body: '1' },
        { organizationId: 'org-a', userId: 'user-dealer', title: 'B', body: '2' }
      ]
    });
    const { POST } = await import('../../app/api/account/notifications/read-all/route');
    const res = await POST(jsonRequest('POST'));
    expect((await jsonBody(res)).data.updated).toBe(2);
  });

  it('gets and updates notification preferences', async () => {
    const { GET } = await import('../../app/api/account/notifications/preferences/route');
    const initial = await jsonBody(await GET());
    expect(initial.data.preference.emailEnabled).toBe(true);

    const { PATCH } = await import('../../app/api/account/notifications/preferences/route');
    const updated = await jsonBody(await PATCH(jsonRequest('PATCH', { emailEnabled: false, pushEnabled: true })));
    expect(updated.data.preference.emailEnabled).toBe(false);
    expect(updated.data.preference.pushEnabled).toBe(true);
  });

  it('rejects marking a notification read without a CSRF token', async () => {
    const notification = await testDb.notification.create({ data: { organizationId: 'org-a', userId: 'user-dealer', title: 'Hi', body: 'there' } });
    const { POST } = await import('../../app/api/account/notifications/[id]/read/route');
    const req = new Request('http://localhost/test', { method: 'POST' });
    const res = await POST(req, { params: { id: notification.id } });
    expect(res.status).toBe(403);
  });

  it('notifies the assignee when a task is created for them', async () => {
    await testDb.user.create({ data: { id: 'user-buyer', email: 'buyer@test.com', firstName: 'Buyer', lastName: 'User', passwordHash: await hashPassword('Test-Fixture-Password-123!') } });
    await testDb.membership.create({ data: { userId: 'user-buyer', organizationId: 'org-a', role: 'DEALER_BUYER' } });

    const { createTaskForOrg } = await import('@/lib/server/crm/task-service');
    await createTaskForOrg('org-a', 'user-dealer', { title: 'Follow up with lead', assignedUserId: 'user-buyer' });

    const notification = await testDb.notification.findFirst({ where: { userId: 'user-buyer' } });
    expect(notification).toBeTruthy();
    expect(notification?.title).toBe('New task assigned to you');
  });

  it('does not crash or notify when a task is assigned to a non-member id', async () => {
    const { createTaskForOrg } = await import('@/lib/server/crm/task-service');
    const task = await createTaskForOrg('org-a', 'user-dealer', { title: 'Orphan task', assignedUserId: 'not-a-real-user' });
    expect(task).toBeTruthy();
    const notification = await testDb.notification.findFirst({ where: { userId: 'not-a-real-user' } });
    expect(notification).toBeNull();
  });
});
