import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';
import { resetRateLimitState } from '@/lib/security/rate-limit';
import { resetDefaultCacheClient } from '@/lib/cache/cache-client';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('analytics and copilot', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  let vehicleA: { id: string; vin: string };
  let customerA: { id: string };

  beforeEach(async () => {
    resetAuth();
    resetRateLimitState();
    // getDealerAnalyticsForOrg caches its result briefly (see
    // lib/server/analytics/analytics-service.ts); several tests below
    // hit the same organizationId with different underlying data, so the
    // cache must not survive between them.
    resetDefaultCacheClient();
    await testDb.saleDocument.deleteMany();
    await testDb.financingApplication.deleteMany();
    await testDb.tradeInVehicle.deleteMany();
    await testDb.sale.deleteMany();
    await testDb.lead.deleteMany();
    await testDb.customer.deleteMany();
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

    vehicleA = await testDb.vehicle.create({
      data: { organizationId: 'org-a', vin: '1HGCM82633A004352', make: 'FORD', model: 'Mustang', acquisitionCost: 15000, acquisitionSource: 'Auction' }
    });
    customerA = await testDb.customer.create({ data: { organizationId: 'org-a', firstName: 'Jane', lastName: 'Doe' } });
    useSession(authMocks.dealer);
  });

  it('reports accurate zero-state analytics for a fresh organization', async () => {
    const { GET } = await import('../../app/api/analytics/dashboard/route');
    const res = await GET(jsonRequest('GET'));
    const body = await jsonBody(res);
    expect(body.data.revenue).toBe(0);
    expect(body.data.salesPerformance.salesCount).toBe(0);
    expect(body.data.acquisitionSources.Auction).toBe(1);
  });

  it('computes real revenue, gross profit, and ROI once a sale completes', async () => {
    const sale = await testDb.sale.create({
      data: { organizationId: 'org-a', vehicleId: vehicleA.id, customerId: customerA.id, salePrice: 22000, status: 'COMPLETED', saleDate: new Date() }
    });
    await testDb.vinAnalysis.create({
      data: { vehicleId: vehicleA.id, decodedPayload: {}, repairEstimate: 500, transportEstimate: 200, feesEstimate: 100, taxesEstimate: 0 }
    });

    const { GET } = await import('../../app/api/analytics/dashboard/route');
    const res = await GET(jsonRequest('GET'));
    const body = await jsonBody(res);

    expect(body.data.revenue).toBe(22000);
    expect(body.data.grossProfit).toBe(7000); // 22000 - 15000 acquisition cost
    expect(body.data.netProfit).toBe(6200); // gross profit - 800 recon/fees
    expect(body.data.salesPerformance.salesCount).toBe(1);
    expect(sale.status).toBe('COMPLETED');
  });

  it('computes real lead conversion from lead statuses', async () => {
    await testDb.lead.createMany({ data: [
      { organizationId: 'org-a', customerId: customerA.id, status: 'WON' },
      { organizationId: 'org-a', customerId: customerA.id, status: 'LOST' },
      { organizationId: 'org-a', customerId: customerA.id, status: 'NEW' },
      { organizationId: 'org-a', customerId: customerA.id, status: 'NEW' }
    ]});

    const { GET } = await import('../../app/api/analytics/dashboard/route');
    const res = await GET(jsonRequest('GET'));
    const body = await jsonBody(res);
    expect(body.data.leadConversion.totalLeads).toBe(4);
    expect(body.data.leadConversion.rate).toBeCloseTo(0.25, 2);
  });

  it('copilot answers a pricing question using the vehicle\'s real stored analysis', async () => {
    await testDb.vinAnalysis.create({ data: { vehicleId: vehicleA.id, decodedPayload: {}, retailValue: 21000, wholesaleValue: 17000, recommendation: 'BUY' } });

    const { POST } = await import('../../app/api/copilot/ask/route');
    const res = await POST(jsonRequest('POST', { question: `What should I price ${vehicleA.vin} at?` }));
    const body = await jsonBody(res);
    expect(body.data.intent).toBe('PRICING_RECOMMENDATION');
    expect(body.data.answer).toContain('21,000');
  });

  it('copilot reports no analysis on file when none exists', async () => {
    const { POST } = await import('../../app/api/copilot/ask/route');
    const res = await POST(jsonRequest('POST', { question: `Should I buy ${vehicleA.vin}?` }));
    const body = await jsonBody(res);
    expect(body.data.intent).toBe('ACQUISITION_RECOMMENDATION');
    expect(body.data.answer).toContain('No analysis on file');
  });

  it('copilot answers inventory questions with real counts', async () => {
    const { POST } = await import('../../app/api/copilot/ask/route');
    const res = await POST(jsonRequest('POST', { question: 'How many vehicles are in stock?' }));
    const body = await jsonBody(res);
    expect(body.data.intent).toBe('INVENTORY_QUESTION');
    expect(body.data.data.total).toBe(1);
  });

  it('copilot returns UNKNOWN with an explanation for unrelated questions', async () => {
    const { POST } = await import('../../app/api/copilot/ask/route');
    const res = await POST(jsonRequest('POST', { question: 'What is the weather today?' }));
    const body = await jsonBody(res);
    expect(body.data.intent).toBe('UNKNOWN');
  });

  it('rejects unauthenticated copilot requests', async () => {
    useSession(null);
    const { POST } = await import('../../app/api/copilot/ask/route');
    const res = await POST(jsonRequest('POST', { question: 'How many vehicles are in stock?' }));
    expect(res.status).toBe(401);
  });
});
