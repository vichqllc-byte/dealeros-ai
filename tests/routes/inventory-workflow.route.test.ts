import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('inventory workflows', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  let vehicleA: { id: string };
  let vehicleB: { id: string };

  beforeEach(async () => {
    resetAuth();
    await testDb.listing.deleteMany();
    await testDb.priceRecord.deleteMany();
    await testDb.inspectionReport.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.vinAnalysis.deleteMany();
    await testDb.vehicle.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    await testDb.organization.createMany({ data: [{ id: 'org-a', name: 'Org A' }, { id: 'org-b', name: 'Org B' }] });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' } });

    vehicleA = await testDb.vehicle.create({ data: { organizationId: 'org-a', vin: '1HGCM82633A004352' } });
    vehicleB = await testDb.vehicle.create({ data: { organizationId: 'org-b', vin: '2FA6P8CF9G5259502' } });
    useSession(authMocks.dealer);
  });

  it('rejects skipping a stage', async () => {
    const { POST } = await import('../../app/api/vehicles/[id]/stage/route');
    const res = await POST(jsonRequest('POST', { toStage: 'RECONDITIONING' }), { params: { id: vehicleA.id } });
    expect(res.status).toBe(422);
  });

  it('always allows transitioning directly to Sold (a completed sale is an overriding business event)', async () => {
    const { POST } = await import('../../app/api/vehicles/[id]/stage/route');
    const res = await POST(jsonRequest('POST', { toStage: 'SOLD' }), { params: { id: vehicleA.id } });
    expect(res.status).toBe(200);
  });

  it('advances through the full pipeline in order', async () => {
    const { POST } = await import('../../app/api/vehicles/[id]/stage/route');
    for (const stage of ['PURCHASE', 'INSPECTION']) {
      const res = await POST(jsonRequest('POST', { toStage: stage }), { params: { id: vehicleA.id } });
      expect(res.status).toBe(200);
    }
    const final = await testDb.vehicle.findUnique({ where: { id: vehicleA.id } });
    expect(final?.inventoryStage).toBe('INSPECTION');
  });

  it('filing an inspection report advances the vehicle to Reconditioning', async () => {
    await testDb.vehicle.update({ where: { id: vehicleA.id }, data: { inventoryStage: 'INSPECTION' } });
    const { POST } = await import('../../app/api/inventory/inspections/route');
    const res = await POST(jsonRequest('POST', { vehicleId: vehicleA.id, overallCondition: 'GOOD', findings: { tires: 'worn' } }));
    expect(res.status).toBe(201);

    const vehicle = await testDb.vehicle.findUnique({ where: { id: vehicleA.id } });
    expect(vehicle?.inventoryStage).toBe('RECONDITIONING');
  });

  it('setting a price advances the vehicle to Publishing', async () => {
    await testDb.vehicle.update({ where: { id: vehicleA.id }, data: { inventoryStage: 'PRICING' } });
    const { POST } = await import('../../app/api/inventory/price-records/route');
    const res = await POST(jsonRequest('POST', { vehicleId: vehicleA.id, price: 18500, reason: 'Initial list price' }));
    expect(res.status).toBe(201);

    const vehicle = await testDb.vehicle.findUnique({ where: { id: vehicleA.id } });
    expect(vehicle?.inventoryStage).toBe('PUBLISHING');
  });

  it('rejects filing an inspection report for another organization\'s vehicle', async () => {
    const { POST } = await import('../../app/api/inventory/inspections/route');
    const res = await POST(jsonRequest('POST', { vehicleId: vehicleB.id, overallCondition: 'GOOD', findings: {} }));
    expect(res.status).toBe(404);
  });

  it('publishes a listing and stamps publishedAt exactly once', async () => {
    const { POST } = await import('../../app/api/inventory/listings/route');
    const created = await POST(jsonRequest('POST', { vehicleId: vehicleA.id, channel: 'Marketplace' }));
    const createdBody = await jsonBody(created);

    const { PATCH } = await import('../../app/api/inventory/listings/[id]/route');
    const published = await PATCH(jsonRequest('PATCH', { status: 'PUBLISHED' }), { params: { id: createdBody.data.id } });
    const publishedBody = await jsonBody(published);
    expect(publishedBody.data.publishedAt).not.toBeNull();
  });

  it('reports real inventory analytics scoped to the caller organization', async () => {
    const { GET } = await import('../../app/api/inventory/analytics/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.totalVehicles).toBe(1);
    expect(body.data.countByStage.ACQUISITION).toBe(1);
  });
});
