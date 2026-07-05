import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('CRM customers and leads', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    resetAuth();
    await testDb.communicationLogEntry.deleteMany();
    await testDb.note.deleteMany();
    await testDb.task.deleteMany();
    await testDb.appointment.deleteMany();
    await testDb.lead.deleteMany();
    await testDb.customer.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.vinAnalysis.deleteMany();
    await testDb.vehicle.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    await testDb.organization.createMany({ data: [{ id: 'org-a', name: 'Org A' }, { id: 'org-b', name: 'Org B' }] });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.createMany({ data: [
      { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash },
      { id: 'user-vendor', email: 'vendor@test.com', firstName: 'Vendor', lastName: 'User', passwordHash },
      { id: 'user-outsider', email: 'out@test.com', firstName: 'Out', lastName: 'User', passwordHash }
    ]});
    await testDb.membership.createMany({ data: [
      { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' },
      { userId: 'user-vendor', organizationId: 'org-a', role: 'VENDOR_MANAGER' },
      { userId: 'user-outsider', organizationId: 'org-b', role: 'DEALER_OWNER' }
    ]});
  });

  it('creates and lists customers scoped to the caller organization', async () => {
    useSession(authMocks.dealer);
    const { POST, GET } = await import('../../app/api/crm/customers/route');
    const created = await POST(jsonRequest('POST', { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }));
    expect(created.status).toBe(201);

    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].organizationId).toBe('org-a');
  });

  it('rejects vendor role from writing customers (requires crm.write)', async () => {
    useSession(authMocks.vendor);
    const { POST } = await import('../../app/api/crm/customers/route');
    const res = await POST(jsonRequest('POST', { firstName: 'Jane', lastName: 'Doe' }));
    expect(res.status).toBe(403);
  });

  it('denies updating a customer from another organization', async () => {
    useSession(authMocks.dealer);
    const customerA = await testDb.customer.create({ data: { organizationId: 'org-a', firstName: 'A', lastName: 'Org' } });
    useSession(authMocks.outsider);
    const { PATCH } = await import('../../app/api/crm/customers/[id]/route');
    const res = await PATCH(jsonRequest('PATCH', { firstName: 'Hacked' }), { params: { id: customerA.id } });
    expect(res.status).toBe(404);

    const untouched = await testDb.customer.findUnique({ where: { id: customerA.id } });
    expect(untouched?.firstName).toBe('A');
  });

  it('creates a lead only when the referenced customer belongs to the org', async () => {
    useSession(authMocks.dealer);
    const customerA = await testDb.customer.create({ data: { organizationId: 'org-a', firstName: 'A', lastName: 'Org' } });
    const customerB = await testDb.customer.create({ data: { organizationId: 'org-b', firstName: 'B', lastName: 'Org' } });

    const { POST } = await import('../../app/api/crm/leads/route');
    const ok1 = await POST(jsonRequest('POST', { customerId: customerA.id, source: 'walk-in' }));
    expect(ok1.status).toBe(201);

    const rejected = await POST(jsonRequest('POST', { customerId: customerB.id, source: 'walk-in' }));
    expect(rejected.status).toBe(404);
  });

  it('validates lead status transitions via PATCH and writes audit/activity logs', async () => {
    useSession(authMocks.dealer);
    const customer = await testDb.customer.create({ data: { organizationId: 'org-a', firstName: 'A', lastName: 'Org' } });
    const { POST } = await import('../../app/api/crm/leads/route');
    const created = await POST(jsonRequest('POST', { customerId: customer.id }));
    const createdBody = await jsonBody(created);

    const { PATCH } = await import('../../app/api/crm/leads/[id]/route');
    const updated = await PATCH(jsonRequest('PATCH', { status: 'QUALIFIED' }), { params: { id: createdBody.data.id } });
    const updatedBody = await jsonBody(updated);
    expect(updatedBody.data.status).toBe('QUALIFIED');

    expect(await testDb.auditLog.count({ where: { entityType: 'lead', entityId: createdBody.data.id } })).toBe(2);
    expect(await testDb.activityLog.count({ where: { entityType: 'lead', entityId: createdBody.data.id } })).toBe(2);
  });

  it('lists due follow-up tasks and excludes completed/future ones', async () => {
    useSession(authMocks.dealer);
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await testDb.task.createMany({ data: [
      { organizationId: 'org-a', title: 'Overdue call', dueAt: past, status: 'PENDING' },
      { organizationId: 'org-a', title: 'Future call', dueAt: future, status: 'PENDING' },
      { organizationId: 'org-a', title: 'Done call', dueAt: past, status: 'COMPLETED' }
    ]});

    const { GET } = await import('../../app/api/crm/follow-ups/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Overdue call');
  });
});
