import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';
import { FullIntelligenceOrchestrator } from '@/lib/vin-intelligence/full-intelligence-orchestrator';
import { VinIntelligenceOrchestrator } from '@/lib/vin-intelligence/vin-intelligence-orchestrator';
import { VinDecoderService } from '@/lib/vin-intelligence/services/vin-decoder-service';
import { RecallService } from '@/lib/vin-intelligence/services/recall-service';
import { MarketIntelligenceService } from '@/lib/vin-intelligence/providers/market-value/market-intelligence-service';
import { HeuristicMarketValueProvider } from '@/lib/vin-intelligence/providers/market-value/heuristic-market-value-provider';
import type { VinDecoderRepository } from '@/lib/vin-intelligence/repositories/vin-decoder-repository';
import type { RecallsRepository } from '@/lib/vin-intelligence/repositories/recalls-repository';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

function fakeOrchestrator() {
  const decoderRepository: VinDecoderRepository = {
    decode: vi.fn(async () => ({
      Make: 'FORD', Model: 'Mustang', ModelYear: String(new Date().getFullYear() - 2), Trim: 'GT',
      BodyClass: 'Coupe', DriveType: 'RWD', EngineHP: '435', ErrorCode: '0', ErrorText: ''
    }))
  };
  const recallsRepository: RecallsRepository = { findByVehicle: vi.fn(async () => []) };
  const vinIntelligence = new VinIntelligenceOrchestrator(new VinDecoderService(decoderRepository), new RecallService(recallsRepository));
  const marketIntelligence = new MarketIntelligenceService([], new HeuristicMarketValueProvider());
  return new FullIntelligenceOrchestrator(vinIntelligence, marketIntelligence);
}

describeForRouteTests('vehicle intelligence platform (history + PDF report)', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  let orgA: { id: string };
  let vehicleA: { id: string };

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
    const orgB = await testDb.organization.create({ data: { id: 'org-b', name: 'Org B' } });
    const passwordHash = await hashPassword('Vehicle-Report-Test-123!');
    const userA = await testDb.user.create({ data: { id: 'user-dealer', email: 'a@report-test.test', firstName: 'A', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: userA.id, organizationId: orgA.id, role: 'DEALER_OWNER' } });

    vehicleA = await testDb.vehicle.create({ data: { organizationId: orgA.id, vin: '1HGCM82633A004352', mileage: 22000, status: 'ANALYZED', make: 'FORD', model: 'Mustang', year: 2022 } });
    await testDb.vinAnalysis.create({ data: { vehicleId: vehicleA.id, decodedPayload: { mileageAtAnalysis: 15000 }, marketValue: 21000 } });
    await testDb.vehicle.create({ data: { organizationId: orgB.id, vin: '2FA6P8CF9G5259502', mileage: 5000, status: 'NEW' } });
  });

  describe('getVehicleHistoryReport', () => {
    it('combines real internal odometer/market history with the recall timeline', async () => {
      const { getVehicleHistoryReport } = await import('@/lib/server/vehicle-history-service');
      const history = await getVehicleHistoryReport(orgA.id, vehicleA.id);

      expect(history.odometerHistory.available).toBe(true);
      expect(history.odometerHistory.items).toHaveLength(1);
      expect(history.odometerHistory.items[0].mileage).toBe(15000);
      expect(history.marketHistory.available).toBe(true);
      // No commercial title-history provider is configured in this test env.
      expect(history.titleHistory.available).toBe(false);
      expect(history.ownershipHistory.available).toBe(false);
    });

    it('rejects a vehicle owned by a different organization', async () => {
      const { getVehicleHistoryReport } = await import('@/lib/server/vehicle-history-service');
      const otherOrgVehicle = await testDb.vehicle.findFirst({ where: { vin: '2FA6P8CF9G5259502' } });
      await expect(getVehicleHistoryReport(orgA.id, otherOrgVehicle!.id)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('generateVehicleIntelligenceReport', () => {
    it('generates a real PDF and writes the audit/activity trail', async () => {
      const { generateVehicleIntelligenceReport } = await import('@/lib/server/vehicle-report-service');
      const { pdfBytes, report, history } = await generateVehicleIntelligenceReport(orgA.id, 'user-dealer', vehicleA.id, fakeOrchestrator());

      expect(Buffer.from(pdfBytes.slice(0, 5)).toString('utf-8')).toBe('%PDF-');
      expect(report.recommendation).toBeDefined();
      expect(history.vin).toBe('1HGCM82633A004352');

      const auditEntry = await testDb.auditLog.findFirst({ where: { entityType: 'vehicle', entityId: vehicleA.id, action: 'vehicle_report_generate' } });
      expect(auditEntry).not.toBeNull();
      const activityEntry = await testDb.activityLog.findFirst({ where: { entityType: 'vehicle', entityId: vehicleA.id, type: 'vehicle.report_generated' } });
      expect(activityEntry).not.toBeNull();
    });

    it('rejects report generation for a vehicle with no recorded mileage', async () => {
      const noMileageVehicle = await testDb.vehicle.create({ data: { organizationId: orgA.id, vin: '3FA6P8CF9G5259503', status: 'NEW' } });
      const { generateVehicleIntelligenceReport } = await import('@/lib/server/vehicle-report-service');
      await expect(generateVehicleIntelligenceReport(orgA.id, 'user-dealer', noMileageVehicle.id, fakeOrchestrator())).rejects.toMatchObject({ status: 422 });
    });
  });

  describe('API routes', () => {
    it('GET /api/vehicles/[id]/history returns the history report for the authenticated org', async () => {
      useSession(authMocks.dealer);
      const { GET } = await import('../../app/api/vehicles/[id]/history/route');
      const res = await GET(jsonRequest('GET'), { params: { id: vehicleA.id } });
      const body = await jsonBody(res);

      expect(res.status).toBe(200);
      expect(body.data.odometerHistory.available).toBe(true);
    });

    it('GET /api/vehicles/[id]/history rejects unauthenticated requests', async () => {
      useSession(null);
      const { GET } = await import('../../app/api/vehicles/[id]/history/route');
      const res = await GET(jsonRequest('GET'), { params: { id: vehicleA.id } });
      expect(res.status).toBe(401);
    });
  });
});
