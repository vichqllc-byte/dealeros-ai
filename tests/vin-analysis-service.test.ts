import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authMocks } from '@/lib/test/auth-mocks';

const state = {
  vehicles: [] as any[],
  vinAnalyses: [] as any[],
  auditLogs: [] as any[],
  activityLogs: [] as any[]
};

vi.mock('@/lib/db/client', () => ({
  db: {
    vehicle: {
      findFirst: vi.fn(async ({ where }) => state.vehicles.find((v) => v.id === where.id && v.organizationId === where.organizationId) || null),
      updateMany: vi.fn(async ({ where, data }) => {
        const rows = state.vehicles.filter((v) => v.id === where.id && v.organizationId === where.organizationId);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      })
    },
    vinAnalysis: {
      findMany: vi.fn(async ({ where }) => state.vinAnalyses.filter((a) => state.vehicles.find((v) => v.id === a.vehicleId)?.organizationId === where.vehicle.organizationId)),
      findFirst: vi.fn(async ({ where }) => state.vinAnalyses.find((a) => a.id === where.id && state.vehicles.find((v) => v.id === a.vehicleId)?.organizationId === where.vehicle.organizationId) || null),
      findFirstOrThrow: vi.fn(async ({ where }) => {
        const row = state.vinAnalyses.find((a) => a.id === where.id && state.vehicles.find((v) => v.id === a.vehicleId)?.organizationId === where.vehicle.organizationId);
        if (!row) throw new Error('Record not found');
        return { ...row };
      }),
      create: vi.fn(async ({ data }) => { const row = { id: `vin-${state.vinAnalyses.length + 1}`, ...data }; state.vinAnalyses.push(row); return { ...row }; }),
      updateMany: vi.fn(async ({ where, data }) => {
        const rows = state.vinAnalyses.filter((a) => a.id === where.id && state.vehicles.find((v) => v.id === a.vehicleId)?.organizationId === where.vehicle.organizationId);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      }),
      deleteMany: vi.fn(async ({ where }) => {
        const before = state.vinAnalyses.length;
        state.vinAnalyses = state.vinAnalyses.filter((a) => !(a.id === where.id && state.vehicles.find((v) => v.id === a.vehicleId)?.organizationId === where.vehicle.organizationId));
        return { count: before - state.vinAnalyses.length };
      })
    },
    auditLog: { create: vi.fn(async ({ data }) => { state.auditLogs.push(data); return data; }) },
    activityLog: { create: vi.fn(async ({ data }) => { state.activityLogs.push(data); return data; }) }
  }
}));

describe('vin analysis service execution', () => {
  beforeEach(() => {
    state.vehicles = [{ id: 'veh-1', organizationId: 'org-1', vin: '1HGCM82633A004352' }, { id: 'veh-2', organizationId: 'org-2', vin: '2HGCM82633A004352' }];
    state.vinAnalyses = [{ id: 'vin-1', vehicleId: 'veh-1', decodedPayload: {}, recommendation: 'BUY' }, { id: 'vin-2', vehicleId: 'veh-2', decodedPayload: {}, recommendation: 'PASS' }];
    state.auditLogs = [];
    state.activityLogs = [];
  });

  it('creates vin analysis and writes audit/activity logs', async () => {
    const { createVinAnalysisForOrg } = await import('@/lib/server/vin-analysis-service');
    const created = await createVinAnalysisForOrg('org-1', authMocks.dealer.userId, { vehicleId: 'veh-1', decodedPayload: {}, confidenceScore: 0.8 });
    expect(created.vehicleId).toBe('veh-1');
    expect(state.vinAnalyses).toHaveLength(3);
    expect(state.auditLogs).toHaveLength(1);
    expect(state.activityLogs).toHaveLength(1);
  });

  it('updates vin analysis only inside organization and writes logs', async () => {
    const { updateVinAnalysisForOrg } = await import('@/lib/server/vin-analysis-service');
    const updated = await updateVinAnalysisForOrg('org-1', authMocks.dealer.userId, 'vin-1', { recommendation: 'NEGOTIATE' });
    expect(updated.recommendation).toBe('NEGOTIATE');
    expect(state.auditLogs).toHaveLength(1);
    expect(state.activityLogs).toHaveLength(1);
  });

  it('persists workflow state for vin analyses', async () => {
    const { createVinAnalysisForOrg, updateVinAnalysisForOrg } = await import('@/lib/server/vin-analysis-service');
    const created = await createVinAnalysisForOrg('org-1', authMocks.dealer.userId, { vehicleId: 'veh-1', decodedPayload: {}, workflowState: 'REVIEWED', confidenceScore: 0.8 });
    const updated = await updateVinAnalysisForOrg('org-1', authMocks.dealer.userId, created.id, { workflowState: 'OFFERED' });
    expect(created.workflowState).toBe('REVIEWED');
    expect(updated.workflowState).toBe('OFFERED');
  });

  it('denies update across organizations', async () => {
    const { updateVinAnalysisForOrg } = await import('@/lib/server/vin-analysis-service');
    await expect(updateVinAnalysisForOrg('org-1', authMocks.dealer.userId, 'vin-2', { recommendation: 'BUY' })).rejects.toMatchObject({ status: 404 });
  });

  it('deletes vin analysis only inside organization and writes logs', async () => {
    const { deleteVinAnalysisForOrg } = await import('@/lib/server/vin-analysis-service');
    const result = await deleteVinAnalysisForOrg('org-1', authMocks.dealer.userId, 'vin-1');
    expect(result.success).toBe(true);
    expect(state.vinAnalyses.some((a) => a.id === 'vin-1')).toBe(false);
    expect(state.auditLogs).toHaveLength(1);
    expect(state.activityLogs).toHaveLength(1);
  });

  it('lists vin analyses only for current organization', async () => {
    const { listVinAnalysesForOrg } = await import('@/lib/server/vin-analysis-service');
    const rows = await listVinAnalysesForOrg('org-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].vehicleId).toBe('veh-1');
  });
});
