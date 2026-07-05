import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

// Regression coverage for a real, previously-missing security control:
// every state-changing route across vehicles/vin-analyses/crm/inventory/
// sales now verifies a double-submit CSRF cookie+header pair (see
// lib/security/guards.ts), not just the Phase 2 auth routes. This test
// deliberately omits the CSRF header/cookie the shared jsonRequest() test
// helper normally attaches, to prove the check is real.
function requestWithoutCsrf(method: string, body?: unknown) {
  return new Request('http://localhost/test', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
}

describeForRouteTests('CSRF enforcement on state-changing routes', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    resetAuth();
    await testDb.activityLog.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.vinAnalysis.deleteMany();
    await testDb.vehicle.deleteMany();
    await testDb.customer.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    await testDb.organization.create({ data: { id: 'org-a', name: 'Org A' } });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' } });
    useSession(authMocks.dealer);
  });

  it('rejects creating a vehicle without a CSRF token', async () => {
    const { POST } = await import('../../app/api/vehicles/route');
    const res = await POST(requestWithoutCsrf('POST', { vin: '1HGCM82633A004352' }));
    expect(res.status).toBe(403);
    expect(await testDb.vehicle.count()).toBe(0);
  });

  it('rejects creating a CRM customer without a CSRF token', async () => {
    const { POST } = await import('../../app/api/crm/customers/route');
    const res = await POST(requestWithoutCsrf('POST', { firstName: 'Jane', lastName: 'Doe' }));
    expect(res.status).toBe(403);
    expect(await testDb.customer.count()).toBe(0);
  });

  it('rejects transitioning a vehicle inventory stage without a CSRF token', async () => {
    const vehicle = await testDb.vehicle.create({ data: { organizationId: 'org-a', vin: '1HGCM82633A004352' } });
    const { POST } = await import('../../app/api/vehicles/[id]/stage/route');
    const res = await POST(requestWithoutCsrf('POST', { toStage: 'PURCHASE' }), { params: { id: vehicle.id } });
    expect(res.status).toBe(403);

    const untouched = await testDb.vehicle.findUnique({ where: { id: vehicle.id } });
    expect(untouched?.inventoryStage).toBe('ACQUISITION');
  });

  it('rejects creating a sale without a CSRF token', async () => {
    const vehicle = await testDb.vehicle.create({ data: { organizationId: 'org-a', vin: '1HGCM82633A004352' } });
    const customer = await testDb.customer.create({ data: { organizationId: 'org-a', firstName: 'Jane', lastName: 'Doe' } });
    const { POST } = await import('../../app/api/sales/route');
    const res = await POST(requestWithoutCsrf('POST', { vehicleId: vehicle.id, customerId: customer.id, salePrice: 20000 }));
    expect(res.status).toBe(403);
  });

  it('still allows GET requests (read-only) without a CSRF token', async () => {
    const { GET } = await import('../../app/api/vehicles/route');
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
