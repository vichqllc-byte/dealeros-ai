import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';
import { getDefaultCacheClient } from '@/lib/cache/cache-client';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('superadmin console routes', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    // Safety net: this suite is the only one that ever sets
    // maintenance_mode, but a persistent shared test DB means a leaked
    // "enabled" row would 503 every other test file that runs after this
    // one (fileParallelism is false, so files run sequentially against
    // the same database). Always leave it disabled.
    await testDb.featureFlag.deleteMany();
    await getDefaultCacheClient().delete('feature-flag:maintenance_mode');
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    resetAuth();
    await testDb.job.deleteMany();
    await testDb.scheduledJobRun.deleteMany();
    await testDb.featureFlag.deleteMany();
    await testDb.superAdminAuditLog.deleteMany();
    await testDb.usageRecord.deleteMany();
    await testDb.invoice.deleteMany();
    await testDb.subscription.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    await testDb.organization.createMany({ data: [{ id: 'org-a', name: 'Org A' }, { id: 'org-b', name: 'Org B' }] });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' } });
    await testDb.user.create({ data: { id: 'user-superadmin', email: 'ops@test.com', firstName: 'Ops', lastName: 'Person', passwordHash, isSuperAdmin: true } });
    // A super admin still needs a normal org membership to log in at all
    // (getSession() requires one) - isSuperAdmin is an orthogonal grant.
    await testDb.membership.create({ data: { userId: 'user-superadmin', organizationId: 'org-a', role: 'DEALER_BUYER' } });
    useSession({ userId: 'user-superadmin', organizationId: 'org-a', role: 'DEALER_BUYER', email: 'ops@test.com', sessionId: 'session-superadmin' });
  });

  afterEach(async () => {
    await getDefaultCacheClient().delete('feature-flag:maintenance_mode');
  });

  it('rejects a non-superadmin from every superadmin route', async () => {
    useSession(authMocks.dealer);
    const { GET } = await import('../../app/api/superadmin/tenants/route');
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('lists all tenants with real member/vehicle counts', async () => {
    await testDb.vehicle.create({ data: { organizationId: 'org-a', vin: '1HGCM82633A004352' } });
    const { GET } = await import('../../app/api/superadmin/tenants/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.tenants).toHaveLength(2);
    const orgA = body.data.tenants.find((t: { id: string }) => t.id === 'org-a');
    expect(orgA.memberCount).toBe(2);
    expect(orgA.vehicleCount).toBe(1);
  });

  it('gets tenant detail including its members', async () => {
    const { GET } = await import('../../app/api/superadmin/tenants/[id]/route');
    const res = await GET(new Request('http://localhost/test'), { params: { id: 'org-a' } });
    const body = await jsonBody(res);
    expect(body.data.tenant.memberships).toHaveLength(2);
  });

  it('returns 404 for an unknown tenant', async () => {
    const { GET } = await import('../../app/api/superadmin/tenants/[id]/route');
    const res = await GET(new Request('http://localhost/test'), { params: { id: 'not-a-real-org' } });
    expect(res.status).toBe(404);
  });

  it('views another organization audit log (cross-tenant, superadmin-only)', async () => {
    await testDb.auditLog.create({ data: { organizationId: 'org-b', action: 'create', entityType: 'vehicle', entityId: 'v1' } });
    const { GET } = await import('../../app/api/superadmin/tenants/[id]/audit/route');
    const res = await GET(new Request('http://localhost/test'), { params: { id: 'org-b' } });
    const body = await jsonBody(res);
    expect(body.data.auditLog).toHaveLength(1);
  });

  it('lists all users platform-wide', async () => {
    const { GET } = await import('../../app/api/superadmin/users/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.users.length).toBeGreaterThanOrEqual(2);
  });

  it('reports a real billing overview derived from actual rows', async () => {
    const subscription = await testDb.subscription.create({ data: { organizationId: 'org-a', planKey: 'STARTER', status: 'ACTIVE', seats: 3 } });
    await testDb.invoice.create({ data: { organizationId: 'org-a', subscriptionId: subscription.id, stripeInvoiceId: 'in_1', status: 'PAID', amountDueCents: 9900, amountPaidCents: 9900 } });

    const { GET } = await import('../../app/api/superadmin/billing/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.billing.totalRevenueCollectedCents).toBe(9900);
    expect(body.data.billing.activeSeats).toBe(3);
  });

  it('reports system health with a real DB connectivity check', async () => {
    const { GET } = await import('../../app/api/superadmin/system-health/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.health.database.healthy).toBe(true);
    expect(typeof body.data.health.counts.organizationCount).toBe('number');
  });

  it('reports provider configuration status without leaking secret values', async () => {
    const { GET } = await import('../../app/api/superadmin/providers/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.providers.stripe).toBe(true); // test env sets a placeholder STRIPE_SECRET_KEY
    expect(body.data.providers.carfax).toBe(false); // never configured in this environment
    expect(JSON.stringify(body)).not.toMatch(/sk_test|whsec_/);
  });

  it('sets and lists a feature flag, recording it in the super-admin audit log', async () => {
    const { PUT } = await import('../../app/api/superadmin/feature-flags/route');
    const res = await PUT(jsonRequest('PUT', { key: 'new_copilot_ui', enabled: true, description: 'Rollout flag' }));
    expect(res.status).toBe(200);

    const { GET } = await import('../../app/api/superadmin/feature-flags/route');
    const list = await jsonBody(await GET());
    expect(list.data.flags).toHaveLength(1);

    const { GET: getAudit } = await import('../../app/api/superadmin/audit/route');
    const audit = await jsonBody(await getAudit());
    expect(audit.data.auditLog[0].entityType).toBe('feature_flag');
  });

  it('enables maintenance mode, blocking a regular user but not a super admin', async () => {
    try {
      const { PUT } = await import('../../app/api/superadmin/feature-flags/route');
      await PUT(jsonRequest('PUT', { key: 'maintenance_mode', enabled: true }));

      useSession(authMocks.dealer);
      const { GET: getVehicles } = await import('../../app/api/vehicles/route');
      const blocked = await getVehicles();
      expect(blocked.status).toBe(503);

      useSession({ userId: 'user-superadmin', organizationId: 'org-a', role: 'DEALER_BUYER', email: 'ops@test.com', sessionId: 'session-superadmin' });
      const { GET: getTenants } = await import('../../app/api/superadmin/tenants/route');
      const allowed = await getTenants();
      expect(allowed.status).toBe(200);
    } finally {
      await testDb.featureFlag.updateMany({ where: { key: 'maintenance_mode' }, data: { enabled: false } });
      await getDefaultCacheClient().delete('feature-flag:maintenance_mode');
    }
  });

  it('lists and ticks the job queue', async () => {
    const { GET } = await import('../../app/api/superadmin/jobs/route');
    const before = await jsonBody(await GET());
    expect(before.data.recentJobs).toEqual([]);

    const { POST } = await import('../../app/api/superadmin/jobs/tick/route');
    const tickRes = await POST(jsonRequest('POST'));
    expect(tickRes.status).toBe(200);
    const tickBody = await jsonBody(tickRes);
    expect(tickBody.data.scheduled.enqueued).toContain('report-usage-to-stripe');

    const after = await jsonBody(await GET());
    expect(after.data.recentJobs.length).toBeGreaterThan(0);
  });
});
