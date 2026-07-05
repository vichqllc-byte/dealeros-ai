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
      findMany: vi.fn(async ({ where }) => state.vehicles.filter((v) => v.organizationId === where.organizationId)),
      findFirst: vi.fn(async ({ where }) => state.vehicles.find((v) => v.id === where.id && v.organizationId === where.organizationId) || null),
      create: vi.fn(async ({ data }) => { const row = { id: `veh-${state.vehicles.length + 1}`, status: 'NEW', ...data }; state.vehicles.push(row); return { ...row }; }),
      update: vi.fn(async ({ where, data }) => { const row = state.vehicles.find((v) => v.id === where.id); Object.assign(row, data); return { ...row }; }),
      delete: vi.fn(async ({ where }) => { const idx = state.vehicles.findIndex((v) => v.id === where.id); const [row] = state.vehicles.splice(idx, 1); return row; })
    },
    auditLog: { create: vi.fn(async ({ data }) => { state.auditLogs.push(data); return data; }) },
    activityLog: { create: vi.fn(async ({ data }) => { state.activityLogs.push(data); return data; }) }
  }
}));

describe('vehicle service execution', () => {
  beforeEach(() => {
    state.vehicles = [{ id: 'veh-1', organizationId: 'org-1', vin: '1HGCM82633A004352', year: 2022, make: 'Ford', model: 'F-150' }, { id: 'veh-2', organizationId: 'org-2', vin: '2HGCM82633A004352' }];
    state.auditLogs = [];
    state.activityLogs = [];
  });

  it('creates vehicle and writes audit/activity logs', async () => {
    const { createVehicleForOrg } = await import('@/lib/server/vehicle-service');
    const created = await createVehicleForOrg(authMocks.dealer.organizationId, authMocks.dealer.userId, { vin: '3HGCM82633A004352', year: 2023, make: 'Honda', model: 'Pilot' });
    expect(created.vin).toBe('3HGCM82633A004352');
    expect(state.vehicles.some((v) => v.vin === '3HGCM82633A004352')).toBe(true);
    expect(state.auditLogs).toHaveLength(1);
    expect(state.activityLogs).toHaveLength(1);
  });

  it('updates vehicle only inside organization and writes logs', async () => {
    const { updateVehicleForOrg } = await import('@/lib/server/vehicle-service');
    const updated = await updateVehicleForOrg('org-1', authMocks.dealer.userId, 'veh-1', { make: 'Toyota' });
    expect(updated.make).toBe('Toyota');
    expect(state.auditLogs).toHaveLength(1);
    expect(state.activityLogs).toHaveLength(1);
  });

  it('persists workflow state for vehicles', async () => {
    const { createVehicleForOrg, updateVehicleForOrg } = await import('@/lib/server/vehicle-service');
    const created = await createVehicleForOrg('org-1', authMocks.dealer.userId, { vin: '4HGCM82633A004352', workflowState: 'CONTACTED' });
    const updated = await updateVehicleForOrg('org-1', authMocks.dealer.userId, created.id, { workflowState: 'OFFERED' });
    expect(created.workflowState).toBe('CONTACTED');
    expect(updated.workflowState).toBe('OFFERED');
  });

  it('denies update across organizations', async () => {
    const { updateVehicleForOrg } = await import('@/lib/server/vehicle-service');
    await expect(updateVehicleForOrg('org-1', authMocks.dealer.userId, 'veh-2', { make: 'Toyota' })).rejects.toMatchObject({ status: 404 });
  });

  it('deletes vehicle only inside organization and writes logs', async () => {
    const { deleteVehicleForOrg } = await import('@/lib/server/vehicle-service');
    const result = await deleteVehicleForOrg('org-1', authMocks.dealer.userId, 'veh-1');
    expect(result.success).toBe(true);
    expect(state.vehicles.some((v) => v.id === 'veh-1')).toBe(false);
    expect(state.auditLogs).toHaveLength(1);
    expect(state.activityLogs).toHaveLength(1);
  });

  it('lists vehicles only for current organization', async () => {
    const { listVehiclesForOrg } = await import('@/lib/server/vehicle-service');
    const rows = await listVehiclesForOrg('org-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].organizationId).toBe('org-1');
  });
});
