import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';
import { VinIntelligenceOrchestrator } from '@/lib/vin-intelligence/vin-intelligence-orchestrator';
import { VinDecoderService } from '@/lib/vin-intelligence/services/vin-decoder-service';
import { RecallService } from '@/lib/vin-intelligence/services/recall-service';
import type { VinDecoderRepository } from '@/lib/vin-intelligence/repositories/vin-decoder-repository';
import type { RecallsRepository } from '@/lib/vin-intelligence/repositories/recalls-repository';

// Replaces the network-bound default orchestrator singleton with a fake for
// the route-handler test below, since the route calls analyzeVehicleVin()
// without an explicit orchestrator override (it uses the module-level
// default). Hoisted by Vitest to run before the route module is imported.
vi.mock('@/lib/vin-intelligence/vin-intelligence-orchestrator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/vin-intelligence/vin-intelligence-orchestrator')>();
  return {
    ...actual,
    vinIntelligenceOrchestrator: {
      analyze: vi.fn(async () => ({
        decoded: { vin: '1HGCM82633A004352', make: 'FORD', model: 'Mustang', modelYear: 2022, raw: {}, factoryOptions: [], safetyEquipment: [], decodeCompletenessPercent: 90, decodeErrorCode: null, decodeErrorText: null, trim: null, series: null, bodyClass: null, driveType: null, transmissionStyle: null, transmissionSpeeds: null, engineCylinders: null, engineDisplacementLiters: null, engineHorsepower: null, engineManufacturer: null, fuelTypePrimary: null, doors: null, plantCity: null, plantCountry: null },
        recalls: [],
        risk: { value: { level: 'Low', score: 0, signals: [] }, reasons: ['clean'] },
        valuation: { value: { value: { retailValue: 20000, wholesaleValue: 16000, marketValue: 18000 }, quality: 'estimated', source: 'test' }, reasons: ['estimated'] },
        damage: { value: { lineItems: [], totalCost: 0 }, reasons: ['no damage'] },
        reconditioning: { value: { tasks: [], totalCost: 0, completionPercent: 0 }, reasons: ['plan'] },
        desirability: { value: 70, reasons: ['desirable'] },
        profitability: { value: { projectedRoi: 0.2, recommendation: 'BUY' }, reasons: ['profitable'] },
        auctionBid: { value: { maxBid: 12000, projectedProfit: 4000, recommendation: 'Proceed' }, reasons: ['proceed'] },
        health: { value: { score: 90, label: 'Excellent' }, reasons: ['healthy'] },
        recommendation: 'BUY',
        confidenceScore: 0.9,
        explanation: ['clean vehicle, strong ROI']
      }))
    }
  };
});

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

function fakeOrchestrator(errorCode = '0') {
  const decoderRepository: VinDecoderRepository = {
    decode: vi.fn(async () => ({
      Make: 'FORD', Model: 'Mustang', ModelYear: String(new Date().getFullYear() - 2), Trim: 'GT',
      BodyClass: 'Coupe', DriveType: 'RWD', TransmissionStyle: 'Manual', EngineCylinders: '8',
      DisplacementL: '5.0', EngineHP: '435', FuelTypePrimary: 'Gasoline', Doors: '2',
      PlantCity: 'FLAT ROCK', PlantCountry: 'UNITED STATES', ErrorCode: errorCode, ErrorText: ''
    }))
  };
  const recallsRepository: RecallsRepository = { findByVehicle: vi.fn(async () => []) };
  return new VinIntelligenceOrchestrator(new VinDecoderService(decoderRepository), new RecallService(recallsRepository));
}

describeForRouteTests('VIN intelligence DB integration', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  let orgA: { id: string };
  let orgB: { id: string };
  let vehicleA: { id: string };
  let vehicleB: { id: string };

  beforeEach(async () => {
    resetAuth();
    await testDb.session.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.vinAnalysis.deleteMany();
    await testDb.vehicle.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    orgA = await testDb.organization.create({ data: { id: 'org-a', name: 'Org A' } });
    orgB = await testDb.organization.create({ data: { id: 'org-b', name: 'Org B' } });
    const passwordHash = await hashPassword('Vin-Intel-Test-123!');
    const userA = await testDb.user.create({ data: { id: 'user-dealer', email: 'a@vin-intel.test', firstName: 'A', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: userA.id, organizationId: orgA.id, role: 'DEALER_OWNER' } });

    vehicleA = await testDb.vehicle.create({ data: { organizationId: orgA.id, vin: '1HGCM82633A004352', mileage: 15000, status: 'NEW' } });
    vehicleB = await testDb.vehicle.create({ data: { organizationId: orgB.id, vin: '2FA6P8CF9G5259502', mileage: 5000, status: 'NEW' } });
  });

  it('persists a real computed VinAnalysis, updates the vehicle, and writes audit/activity logs', async () => {
    const { analyzeVehicleVin } = await import('@/lib/server/vin-intelligence-service');
    const orchestrator = fakeOrchestrator();

    const { analysis, report } = await analyzeVehicleVin(orgA.id, 'user-dealer', { vehicleId: vehicleA.id, vin: '1HGCM82633A004352', mileage: 22000 }, orchestrator);

    expect(analysis.recommendation).toBe(report.recommendation);
    expect(Number(analysis.marketValue)).toBeGreaterThan(0);
    expect(analysis.riskSummary).toBeTruthy();
    expect(analysis.aiExplanation).toBeTruthy();

    const updatedVehicle = await testDb.vehicle.findUnique({ where: { id: vehicleA.id } });
    expect(updatedVehicle?.status).toBe('ANALYZED');
    expect(updatedVehicle?.mileage).toBe(22000);
    expect(updatedVehicle?.make).toBe('FORD');

    const auditEntry = await testDb.auditLog.findFirst({ where: { entityType: 'vin_analysis', entityId: analysis.id } });
    expect(auditEntry?.action).toBe('vin_intelligence_analyze');

    const activityEntry = await testDb.activityLog.findFirst({ where: { entityType: 'vin_analysis', entityId: analysis.id } });
    expect(activityEntry?.type).toBe('vin_analysis.ai_analyzed');
  });

  it('detects an odometer rollback using this vehicle\'s own prior VinAnalysis history', async () => {
    const { analyzeVehicleVin } = await import('@/lib/server/vin-intelligence-service');

    await analyzeVehicleVin(orgA.id, 'user-dealer', { vehicleId: vehicleA.id, vin: '1HGCM82633A004352', mileage: 60000 }, fakeOrchestrator());
    const { report } = await analyzeVehicleVin(orgA.id, 'user-dealer', { vehicleId: vehicleA.id, vin: '1HGCM82633A004352', mileage: 30000 }, fakeOrchestrator());

    expect(report.risk.value.signals.some((s) => s.includes('Odometer anomaly'))).toBe(true);
  });

  it('rejects analysis for a vehicle owned by a different organization', async () => {
    const { analyzeVehicleVin } = await import('@/lib/server/vin-intelligence-service');
    await expect(
      analyzeVehicleVin(orgA.id, 'user-dealer', { vehicleId: vehicleB.id, vin: '2FA6P8CF9G5259502', mileage: 10000 }, fakeOrchestrator())
    ).rejects.toMatchObject({ status: 404 });

    const untouched = await testDb.vehicle.findUnique({ where: { id: vehicleB.id } });
    expect(untouched?.status).toBe('NEW');
    expect(untouched?.mileage).toBe(5000);
  });

  it('flags a VIN checksum failure as a risk signal and drives the recommendation to PASS', async () => {
    const { analyzeVehicleVin } = await import('@/lib/server/vin-intelligence-service');
    const { report } = await analyzeVehicleVin(
      orgA.id,
      'user-dealer',
      { vehicleId: vehicleA.id, vin: '2FA6P8CF9G5259502', mileage: 22000 },
      fakeOrchestrator('1')
    );

    expect(report.risk.value.level).not.toBe('Low');
    expect(report.recommendation).toBe('PASS');
  });

  it('POST /api/vin-analyses/analyze returns a full report and persists it for the authenticated org', async () => {
    useSession(authMocks.dealer);
    const { POST } = await import('../../app/api/vin-analyses/analyze/route');
    const res = await POST(jsonRequest('POST', { vehicleId: vehicleA.id, vin: '1HGCM82633A004352', mileage: 22000 }));
    const body = await jsonBody(res);

    expect(res.status).toBe(201);
    expect(body.data.decoded.make).toBe('FORD');
    expect(body.data.profitability.value.recommendation).toBe('BUY');
    expect(await testDb.vinAnalysis.count({ where: { vehicleId: vehicleA.id } })).toBe(1);
  });

  it('POST /api/vin-analyses/analyze rejects unauthenticated requests', async () => {
    useSession(null);
    const { POST } = await import('../../app/api/vin-analyses/analyze/route');
    const res = await POST(jsonRequest('POST', { vehicleId: vehicleA.id, vin: '1HGCM82633A004352', mileage: 22000 }));
    expect(res.status).toBe(401);
  });

  it('POST /api/vin-analyses/analyze rejects vendor role (requires vin.write)', async () => {
    useSession(authMocks.vendor);
    const { POST } = await import('../../app/api/vin-analyses/analyze/route');
    const res = await POST(jsonRequest('POST', { vehicleId: vehicleA.id, vin: '1HGCM82633A004352', mileage: 22000 }));
    expect(res.status).toBe(403);
  });
});
