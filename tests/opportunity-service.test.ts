import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  vehicles: [] as any[]
};

vi.mock('@/lib/db/client', () => ({
  db: {
    vehicle: {
      findMany: vi.fn(async ({ where }) => state.vehicles.filter((v) => v.organizationId === where.organizationId))
    }
  }
}));

describe('opportunity service', () => {
  beforeEach(() => {
    state.vehicles = [
      {
        id: 'veh-1',
        organizationId: 'org-1',
        vin: '1HGCM82633A004352',
        status: 'ANALYZED',
        mileage: 20000,
        vinAnalyses: [{ recommendation: 'BUY', confidenceScore: 0.9, projectedRoi: 0.18 }]
      },
      {
        id: 'veh-2',
        organizationId: 'org-1',
        vin: '2HGCM82633A004352',
        status: 'NEW',
        mileage: 140000,
        vinAnalyses: [{ recommendation: 'PASS', confidenceScore: 0.4, projectedRoi: 0.02 }]
      }
    ];
  });

  it('scores opportunities with AI-style reasoning', async () => {
    const { listOpportunitySummariesForOrg } = await import('@/lib/server/opportunity-service');
    const rows = await listOpportunitySummariesForOrg('org-1');
    expect(rows[0].label).toBe('High');
    expect(rows[0].score).toBeGreaterThan(rows[1].score);
    expect(rows[0].reasons.length).toBeGreaterThan(0);
  });
});
