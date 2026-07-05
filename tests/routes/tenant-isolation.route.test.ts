import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, ensureTestDatabase } from '../setup/route-test-helpers';
import { hashPassword } from '@/lib/security/password';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('tenant isolation', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  let orgA: { id: string };
  let orgB: { id: string };
  let vehicleA: { id: string; vin: string; make: string | null };
  let vehicleB: { id: string; vin: string; make: string | null };
  let analysisA: { id: string };
  let analysisB: { id: string };

  beforeEach(async () => {
    await testDb.session.deleteMany();
    await testDb.passwordResetToken.deleteMany();
    await testDb.emailVerificationToken.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.vinAnalysis.deleteMany();
    await testDb.vehicle.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    orgA = await testDb.organization.create({ data: { name: 'Tenant A Motors' } });
    orgB = await testDb.organization.create({ data: { name: 'Tenant B Auto' } });

    const passwordHash = await hashPassword('Tenant-Isolation-Test-123!');
    const userA = await testDb.user.create({ data: { email: 'owner-a@tenant.test', firstName: 'Owner', lastName: 'A', passwordHash } });
    const userB = await testDb.user.create({ data: { email: 'owner-b@tenant.test', firstName: 'Owner', lastName: 'B', passwordHash } });
    await testDb.membership.create({ data: { userId: userA.id, organizationId: orgA.id, role: 'DEALER_OWNER' } });
    await testDb.membership.create({ data: { userId: userB.id, organizationId: orgB.id, role: 'DEALER_OWNER' } });

    vehicleA = await testDb.vehicle.create({ data: { organizationId: orgA.id, vin: '1FA6P8CF9G5259501', make: 'Ford', status: 'ANALYZED' } });
    vehicleB = await testDb.vehicle.create({ data: { organizationId: orgB.id, vin: '2FA6P8CF9G5259502', make: 'Toyota', status: 'NEGOTIATING' } });

    analysisA = await testDb.vinAnalysis.create({ data: { vehicleId: vehicleA.id, decodedPayload: { vin: vehicleA.vin }, confidenceScore: 0.9, recommendation: 'BUY' } });
    analysisB = await testDb.vinAnalysis.create({ data: { vehicleId: vehicleB.id, decodedPayload: { vin: vehicleB.vin }, confidenceScore: 0.5, recommendation: 'PASS' } });

    await testDb.activityLog.create({ data: { organizationId: orgA.id, entityType: 'vehicle', entityId: vehicleA.id, type: 'vehicle.created', summary: 'Tenant A activity: confidential deal notes' } });
    await testDb.activityLog.create({ data: { organizationId: orgB.id, entityType: 'vehicle', entityId: vehicleB.id, type: 'vehicle.created', summary: 'Tenant B activity: confidential deal notes' } });

    await testDb.auditLog.create({ data: { organizationId: orgA.id, action: 'create', entityType: 'vehicle', entityId: vehicleA.id } });
    await testDb.auditLog.create({ data: { organizationId: orgB.id, action: 'create', entityType: 'vehicle', entityId: vehicleB.id } });
  });

  it('vendor dashboard only reflects the caller organization (regression: previously unscoped)', async () => {
    const { loadVendorDashboard } = await import('@/lib/loaders/dashboard');
    const dashboardA = await loadVendorDashboard(orgA.id);

    // org A has 1 ANALYZED vehicle and 0 NEGOTIATING; org B's NEGOTIATING
    // vehicle must not be counted or surfaced for org A's vendor view.
    expect(dashboardA.quoteRequestsOpen).toBe(1);
    expect(dashboardA.activeJobs).toBe(0);
    expect(dashboardA.recentMessages.every((m) => !m.body.includes('Tenant B'))).toBe(true);
    expect(dashboardA.recentMessages.some((m) => m.body.includes('Tenant A'))).toBe(true);

    const dashboardB = await loadVendorDashboard(orgB.id);
    expect(dashboardB.quoteRequestsOpen).toBe(0);
    expect(dashboardB.activeJobs).toBe(1);
    expect(dashboardB.recentMessages.every((m) => !m.body.includes('Tenant A'))).toBe(true);
  });

  it('admin dashboard only reflects the caller organization (regression: previously platform-wide)', async () => {
    const { loadAdminDashboard } = await import('@/lib/loaders/dashboard');
    const dashboardA = await loadAdminDashboard(orgA.id);

    expect(dashboardA.organizationName).toBe('Tenant A Motors');
    expect(dashboardA.vehicleCount).toBe(1);
    expect(dashboardA.auditCount).toBe(1);
    expect(dashboardA.recentActivity.every((a) => !a.summary.includes('Tenant B'))).toBe(true);
    expect(dashboardA.recentAudit.every((a) => a.entityId !== vehicleB.id)).toBe(true);
  });

  it('dealer dashboard only reflects the caller organization', async () => {
    const { loadDealerDashboard } = await import('@/lib/loaders/dashboard');
    const dashboardA = await loadDealerDashboard(orgA.id);

    expect(dashboardA.vehicleCount).toBe(1);
    expect(dashboardA.recentVehicles.every((v) => v.organizationId === orgA.id)).toBe(true);
    expect(dashboardA.analyses.every((a) => a.vehicle.organizationId === orgA.id)).toBe(true);
    expect(dashboardA.activity.every((a) => a.organizationId === orgA.id)).toBe(true);
    expect(dashboardA.opportunities.every((o) => o.id !== vehicleB.id)).toBe(true);
  });

  it('opportunity summaries never include another organization\'s vehicles', async () => {
    const { listOpportunitySummariesForOrg } = await import('@/lib/server/opportunity-service');
    const opportunitiesA = await listOpportunitySummariesForOrg(orgA.id);
    expect(opportunitiesA).toHaveLength(1);
    expect(opportunitiesA[0].id).toBe(vehicleA.id);
  });

  it('cross-organization vehicle update is rejected and leaves the target record untouched', async () => {
    const { updateVehicleForOrg } = await import('@/lib/server/vehicle-service');
    await expect(updateVehicleForOrg(orgA.id, 'attacker-user', vehicleB.id, { make: 'Hacked' })).rejects.toMatchObject({ status: 404 });

    const untouched = await testDb.vehicle.findUnique({ where: { id: vehicleB.id } });
    expect(untouched?.make).toBe('Toyota');
  });

  it('cross-organization vehicle delete is rejected and leaves the target record untouched', async () => {
    const { deleteVehicleForOrg } = await import('@/lib/server/vehicle-service');
    await expect(deleteVehicleForOrg(orgA.id, 'attacker-user', vehicleB.id)).rejects.toMatchObject({ status: 404 });

    const stillExists = await testDb.vehicle.findUnique({ where: { id: vehicleB.id } });
    expect(stillExists).not.toBeNull();
  });

  it('cross-organization vin analysis update is rejected and leaves the target record untouched', async () => {
    const { updateVinAnalysisForOrg } = await import('@/lib/server/vin-analysis-service');
    await expect(updateVinAnalysisForOrg(orgA.id, 'attacker-user', analysisB.id, { recommendation: 'BUY' })).rejects.toMatchObject({ status: 404 });

    const untouched = await testDb.vinAnalysis.findUnique({ where: { id: analysisB.id } });
    expect(untouched?.recommendation).toBe('PASS');
  });

  it('cross-organization vin analysis delete is rejected and leaves the target record untouched', async () => {
    const { deleteVinAnalysisForOrg } = await import('@/lib/server/vin-analysis-service');
    await expect(deleteVinAnalysisForOrg(orgA.id, 'attacker-user', analysisB.id)).rejects.toMatchObject({ status: 404 });

    const stillExists = await testDb.vinAnalysis.findUnique({ where: { id: analysisB.id } });
    expect(stillExists).not.toBeNull();
  });

  it('creating a vin analysis cannot flip another organization\'s vehicle status', async () => {
    const { createVinAnalysisForOrg } = await import('@/lib/server/vin-analysis-service');
    // Attempt to analyze org B's vehicle while authenticated as org A - the
    // ownership check must reject this before any vehicle status mutation.
    await expect(
      createVinAnalysisForOrg(orgA.id, 'attacker-user', { vehicleId: vehicleB.id, decodedPayload: {} })
    ).rejects.toMatchObject({ status: 404 });

    const untouched = await testDb.vehicle.findUnique({ where: { id: vehicleB.id } });
    expect(untouched?.status).toBe('NEGOTIATING');
  });

  it('listVehiclesForOrg and listVinAnalysesForOrg never cross tenant boundaries', async () => {
    const { listVehiclesForOrg } = await import('@/lib/server/vehicle-service');
    const { listVinAnalysesForOrg } = await import('@/lib/server/vin-analysis-service');

    const vehiclesA = await listVehiclesForOrg(orgA.id);
    expect(vehiclesA.map((v) => v.id)).toEqual([vehicleA.id]);

    const analysesA = await listVinAnalysesForOrg(orgA.id);
    expect(analysesA.map((a) => a.id)).toEqual([analysisA.id]);
  });
});
