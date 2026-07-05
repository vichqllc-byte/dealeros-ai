import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('vin analysis routes', () => {
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

    await testDb.organization.createMany({ data: [{ id: 'org-a', name: 'Org A' }, { id: 'org-b', name: 'Org B' }] });
    const testPasswordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.createMany({ data: [
      { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash: testPasswordHash },
      { id: 'user-vendor', email: 'vendor@test.com', firstName: 'Vendor', lastName: 'User', passwordHash: testPasswordHash },
      { id: 'user-admin', email: 'admin@test.com', firstName: 'Admin', lastName: 'User', passwordHash: testPasswordHash },
      { id: 'user-outsider', email: 'out@test.com', firstName: 'Out', lastName: 'User', passwordHash: testPasswordHash }
    ]});
    await testDb.membership.createMany({ data: [
      { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' },
      { userId: 'user-vendor', organizationId: 'org-a', role: 'VENDOR_MANAGER' },
      { userId: 'user-admin', organizationId: 'org-a', role: 'ADMIN' },
      { userId: 'user-outsider', organizationId: 'org-b', role: 'DEALER_OWNER' }
    ]});
    await testDb.vehicle.createMany({ data: [
      { id: 'veh-a', organizationId: 'org-a', vin: '1HGCM82633A004352' },
      { id: 'veh-b', organizationId: 'org-b', vin: '2HGCM82633A004352' }
    ]});
    await testDb.vinAnalysis.createMany({ data: [
      { id: 'vin-a', vehicleId: 'veh-a', decodedPayload: { vin: '1HGCM82633A004352' }, confidenceScore: 0.8 },
      { id: 'vin-b', vehicleId: 'veh-b', decodedPayload: { vin: '2HGCM82633A004352' }, confidenceScore: 0.5 }
    ]});
  });
  it('GET returns org-scoped analyses for dealer', async () => {
    useSession(authMocks.dealer);
    const { GET } = await import('../../app/api/vin-analyses/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].vehicleId).toBe('veh-a');
  });

  it('POST persists analysis and writes logs', async () => {
    useSession(authMocks.dealer);
    const { POST } = await import('../../app/api/vin-analyses/route');
    const res = await POST(jsonRequest('POST', { vehicleId: 'veh-a', decodedPayload: { vin: '1HGCM82633A004352' }, confidenceScore: 0.9 }));
    const body = await jsonBody(res);
    expect(res.status).toBe(201);
    expect(await testDb.vinAnalysis.count({ where: { id: body.data.id } })).toBe(1);
    expect(await testDb.auditLog.count({ where: { entityType: 'vin_analysis', entityId: body.data.id } })).toBe(1);
    expect(await testDb.activityLog.count({ where: { entityType: 'vin_analysis', entityId: body.data.id } })).toBe(1);
  });

  it('PATCH updates same-organization analysis', async () => {
    useSession(authMocks.dealer);
    const { PATCH } = await import('../../app/api/vin-analyses/[id]/route');
    const res = await PATCH(jsonRequest('PATCH', { confidenceScore: 0.95 }), { params: { id: 'vin-a' } });
    expect(res.status).toBe(200);
    expect((await testDb.vinAnalysis.findUnique({ where: { id: 'vin-a' } }))?.confidenceScore).toBe(0.95);
  });

  it('DELETE removes same-organization analysis and writes logs', async () => {
    useSession(authMocks.dealer);
    const { DELETE } = await import('../../app/api/vin-analyses/[id]/route');
    const res = await DELETE(jsonRequest('DELETE'), { params: { id: 'vin-a' } });
    expect(res.status).toBe(200);
    expect(await testDb.vinAnalysis.findUnique({ where: { id: 'vin-a' } })).toBeNull();
    expect(await testDb.auditLog.count({ where: { entityType: 'vin_analysis', entityId: 'vin-a' } })).toBe(1);
    expect(await testDb.activityLog.count({ where: { entityType: 'vin_analysis', entityId: 'vin-a' } })).toBe(1);
  });

  it('rejects unauthenticated access', async () => {
    useSession(null);
    const { GET } = await import('../../app/api/vin-analyses/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('rejects vendor write access', async () => {
    useSession(authMocks.vendor);
    const { POST } = await import('../../app/api/vin-analyses/route');
    const res = await POST(jsonRequest('POST', { vehicleId: 'veh-a', decodedPayload: {} }));
    expect(res.status).toBe(403);
  });

  it('denies wrong-organization update and delete', async () => {
    useSession(authMocks.dealer);
    const route = await import('../../app/api/vin-analyses/[id]/route');
    expect((await route.PATCH(jsonRequest('PATCH', { confidenceScore: 0.7 }), { params: { id: 'vin-b' } })).status).toBe(404);
    expect((await route.DELETE(jsonRequest('DELETE'), { params: { id: 'vin-b' } })).status).toBe(404);
  });

  it('returns validation errors on bad input', async () => {
    useSession(authMocks.dealer);
    const { POST } = await import('../../app/api/vin-analyses/route');
    const res = await POST(jsonRequest('POST', { vehicleId: '', decodedPayload: {}, confidenceScore: 2 }));
    expect(res.status).toBe(422);
  });
});
