import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('sales domain', () => {
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

    await testDb.organization.createMany({ data: [{ id: 'org-a', name: 'Org A' }, { id: 'org-b', name: 'Org B' }] });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' } });

    vehicleA = await testDb.vehicle.create({ data: { organizationId: 'org-a', vin: '1HGCM82633A004352', status: 'NEW' } });
    customerA = await testDb.customer.create({ data: { organizationId: 'org-a', firstName: 'Jane', lastName: 'Doe' } });
    useSession(authMocks.dealer);
  });

  it('builds a deal, completes it, and transitions the vehicle to Sold', async () => {
    const { POST } = await import('../../app/api/sales/route');
    const created = await POST(jsonRequest('POST', { vehicleId: vehicleA.id, customerId: customerA.id, salePrice: 24000 }));
    const createdBody = await jsonBody(created);
    expect(created.status).toBe(201);
    expect(createdBody.data.deliveryChecklist.length).toBeGreaterThan(0);

    const { PATCH } = await import('../../app/api/sales/[id]/route');
    const completed = await PATCH(jsonRequest('PATCH', { status: 'COMPLETED' }), { params: { id: createdBody.data.id } });
    expect(completed.status).toBe(200);

    const vehicle = await testDb.vehicle.findUnique({ where: { id: vehicleA.id } });
    expect(vehicle?.status).toBe('SOLD');
    expect(vehicle?.inventoryStage).toBe('SOLD');
  });

  it('rejects building a deal for a vehicle from another organization', async () => {
    const vehicleB = await testDb.vehicle.create({ data: { organizationId: 'org-b', vin: '2FA6P8CF9G5259502' } });
    const { POST } = await import('../../app/api/sales/route');
    const res = await POST(jsonRequest('POST', { vehicleId: vehicleB.id, customerId: customerA.id, salePrice: 20000 }));
    expect(res.status).toBe(404);
  });

  it('toggles a delivery checklist item and persists the change', async () => {
    const { POST } = await import('../../app/api/sales/route');
    const created = await POST(jsonRequest('POST', { vehicleId: vehicleA.id, customerId: customerA.id, salePrice: 24000 }));
    const createdBody = await jsonBody(created);
    const firstItemId = createdBody.data.deliveryChecklist[0].id;

    const { PATCH } = await import('../../app/api/sales/[id]/checklist/route');
    const res = await PATCH(jsonRequest('PATCH', { itemId: firstItemId, completed: true }), { params: { id: createdBody.data.id } });
    const body = await jsonBody(res);
    expect(body.data.find((i: { id: string }) => i.id === firstItemId).completed).toBe(true);
  });

  it('accepts a manually entered trade-in appraisal', async () => {
    const { POST: createSale } = await import('../../app/api/sales/route');
    const sale = await jsonBody(await createSale(jsonRequest('POST', { vehicleId: vehicleA.id, customerId: customerA.id, salePrice: 24000 })));

    const { POST } = await import('../../app/api/sales/[id]/trade-ins/route');
    const res = await POST(jsonRequest('POST', { make: 'Toyota', model: 'Camry', appraisedValue: 9000 }), { params: { id: sale.data.id } });
    expect(res.status).toBe(201);
    expect((await jsonBody(res)).data.appraisedValue).toBeTruthy();
  });

  it('auto-appraises a trade-in from a decoded VIN when no manual value is given', async () => {
    vi.mock('@/lib/vin-intelligence/services/vin-decoder-service', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/vin-intelligence/services/vin-decoder-service')>();
      return {
        ...actual,
        vinDecoderService: {
          decode: vi.fn(async () => ({
            vin: '2FA6P8CF9G5259502', make: 'FORD', model: 'Mustang', modelYear: 2020, trim: null, series: null,
            bodyClass: 'Coupe', driveType: 'RWD', transmissionStyle: null, transmissionSpeeds: null,
            engineCylinders: null, engineDisplacementLiters: null, engineHorsepower: '300', engineManufacturer: null,
            fuelTypePrimary: null, doors: null, plantCity: null, plantCountry: null, factoryOptions: [], safetyEquipment: [],
            decodeErrorCode: null, decodeErrorText: null, decodeCompletenessPercent: 90, raw: {}
          }))
        }
      };
    });

    const { createTradeInForSale } = await import('@/lib/server/sales/trade-in-service');
    const { POST: createSale } = await import('../../app/api/sales/route');
    const sale = await jsonBody(await createSale(jsonRequest('POST', { vehicleId: vehicleA.id, customerId: customerA.id, salePrice: 24000 })));

    const tradeIn = await createTradeInForSale('org-a', 'user-dealer', sale.data.id, { vin: '2FA6P8CF9G5259502', mileage: 40000 });
    expect(Number(tradeIn.appraisedValue)).toBeGreaterThan(0);
  });

  it('submits a financing application and computes the real monthly payment', async () => {
    const { POST: createSale } = await import('../../app/api/sales/route');
    const sale = await jsonBody(await createSale(jsonRequest('POST', { vehicleId: vehicleA.id, customerId: customerA.id, salePrice: 24000 })));

    const { POST } = await import('../../app/api/sales/[id]/financing/route');
    const res = await POST(jsonRequest('POST', { principal: 20000, apr: 6, termMonths: 60 }), { params: { id: sale.data.id } });
    const body = await jsonBody(res);
    expect(res.status).toBe(201);
    expect(body.data.payment.monthlyPayment).toBeCloseTo(386.66, 1);
  });

  it('generates a real PDF for a sale document and records a manual signature', async () => {
    const { POST: createSale } = await import('../../app/api/sales/route');
    const sale = await jsonBody(await createSale(jsonRequest('POST', { vehicleId: vehicleA.id, customerId: customerA.id, salePrice: 24000 })));

    const { POST: createDocument } = await import('../../app/api/sales/[id]/documents/route');
    const document = await jsonBody(await createDocument(jsonRequest('POST', { type: 'PURCHASE_AGREEMENT' }), { params: { id: sale.data.id } }));

    const { GET: getPdf } = await import('../../app/api/sales/[id]/documents/[documentId]/pdf/route');
    const pdfRes = await getPdf(jsonRequest('GET'), { params: { id: sale.data.id, documentId: document.data.id } });
    expect(pdfRes.headers.get('Content-Type')).toBe('application/pdf');

    const { POST: sign } = await import('../../app/api/sales/[id]/documents/[documentId]/sign/route');
    const signRes = await sign(jsonRequest('POST', { signedByName: 'Jane Doe' }), { params: { id: sale.data.id, documentId: document.data.id } });
    const signBody = await jsonBody(signRes);
    expect(signBody.data.signatureStatus).toBe('SIGNED');
    expect(signBody.data.signatureMethod).toBe('MANUAL_WET_SIGNATURE');
  });

  it('rejects sales access without the sales.read/write permission', async () => {
    useSession(authMocks.vendor);
    const { GET } = await import('../../app/api/sales/route');
    const res = await GET();
    expect(res.status).toBe(403);
  });
});
