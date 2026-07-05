import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('account self-service routes', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  let currentSessionId: string;
  let otherSessionId: string;

  beforeEach(async () => {
    resetAuth();
    await testDb.activityLog.deleteMany();
    await testDb.session.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    await testDb.organization.create({ data: { id: 'org-a', name: 'Org A' } });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' } });

    const current = await testDb.session.create({
      data: {
        userId: 'user-dealer',
        accessTokenHash: 'current-hash',
        refreshTokenHash: 'current-refresh-hash',
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        accessExpiresAt: new Date(Date.now() + 60_000),
        refreshExpiresAt: new Date(Date.now() + 60_000)
      }
    });
    currentSessionId = current.id;

    const other = await testDb.session.create({
      data: {
        userId: 'user-dealer',
        accessTokenHash: 'other-hash',
        refreshTokenHash: 'other-refresh-hash',
        accessExpiresAt: new Date(Date.now() + 60_000),
        refreshExpiresAt: new Date(Date.now() + 60_000)
      }
    });
    otherSessionId = other.id;

    await testDb.activityLog.create({
      data: { organizationId: 'org-a', actorUserId: 'user-dealer', entityType: 'session', entityId: current.id, type: 'user.login', summary: 'Logged in' }
    });

    useSession({ ...authMocks.dealer, sessionId: currentSessionId });
  });

  it('lists the current user sessions, flagging the current one', async () => {
    const { GET } = await import('../../app/api/account/sessions/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.sessions).toHaveLength(2);
    const current = body.data.sessions.find((s: { id: string }) => s.id === currentSessionId);
    expect(current.isCurrent).toBe(true);
  });

  it('revokes another one of the user own sessions', async () => {
    const { DELETE } = await import('../../app/api/account/sessions/[id]/route');
    const res = await DELETE(jsonRequest('DELETE'), { params: { id: otherSessionId } });
    expect(res.status).toBe(200);

    const revoked = await testDb.session.findUnique({ where: { id: otherSessionId } });
    expect(revoked?.revokedAt).toBeTruthy();
  });

  it('refuses to revoke a session belonging to a different user', async () => {
    await testDb.user.create({ data: { id: 'user-other', email: 'other@test.com', firstName: 'Other', lastName: 'User', passwordHash: await hashPassword('Test-Fixture-Password-123!') } });
    const foreignSession = await testDb.session.create({
      data: {
        userId: 'user-other',
        accessTokenHash: 'foreign-hash',
        refreshTokenHash: 'foreign-refresh-hash',
        accessExpiresAt: new Date(Date.now() + 60_000),
        refreshExpiresAt: new Date(Date.now() + 60_000)
      }
    });

    const { DELETE } = await import('../../app/api/account/sessions/[id]/route');
    const res = await DELETE(jsonRequest('DELETE'), { params: { id: foreignSession.id } });
    expect(res.status).toBe(404);
  });

  it('lists recent activity for the current user', async () => {
    const { GET } = await import('../../app/api/account/activity/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.activity).toHaveLength(1);
    expect(body.data.activity[0].type).toBe('user.login');
  });

  it('rejects account routes when not authenticated', async () => {
    useSession(authMocks.none);
    const { GET } = await import('../../app/api/account/sessions/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
