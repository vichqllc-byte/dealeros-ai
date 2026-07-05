import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('exports', () => {
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
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    await testDb.organization.create({ data: { id: 'org-a', name: 'Org A' } });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' } });
    await testDb.vehicle.create({ data: { organizationId: 'org-a', vin: '1HGCM82633A004352', acquisitionCost: 12000, acquisitionSource: 'Trade-in' } });
    useSession(authMocks.dealer);
  });

  it('exports inventory as CSV by default', async () => {
    const { GET } = await import('../../app/api/inventory/export/route');
    const res = await GET(jsonRequest('GET'));
    expect(res.headers.get('Content-Type')).toBe('text/csv');
    const text = await res.text();
    expect(text).toContain('1HGCM82633A004352');
    expect(text).toContain('Trade-in');
  });

  it('exports inventory as Excel when format=xlsx', async () => {
    const { GET } = await import('../../app/api/inventory/export/route');
    const res = await GET(new Request('http://localhost/test?format=xlsx'));
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml');
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('exports analytics as CSV', async () => {
    const { GET } = await import('../../app/api/analytics/dashboard/export/route');
    const res = await GET(new Request('http://localhost/test'));
    expect(res.headers.get('Content-Type')).toBe('text/csv');
    const text = await res.text();
    expect(text).toContain('Revenue');
  });

  it('rejects export access without vehicles.read permission', async () => {
    useSession(null);
    const { GET } = await import('../../app/api/inventory/export/route');
    const res = await GET(new Request('http://localhost/test'));
    expect(res.status).toBe(401);
  });
});
