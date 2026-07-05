import { describe, expect, it, vi } from 'vitest';
import { authMocks } from '@/lib/test/auth-mocks';

const state = {
  vehicles: [] as any[],
  activityLogs: [] as any[],
  auditLogs: [] as any[]
};

vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/db/client', () => ({
  db: {
    vehicle: {
      count: vi.fn(async ({ where }) => state.vehicles.filter((item) => item.organizationId === where.organizationId).length)
    },
    activityLog: { count: vi.fn(async ({ where }) => state.activityLogs.filter((item) => item.organizationId === where.organizationId).length) },
    auditLog: { count: vi.fn(async ({ where }) => state.auditLogs.filter((item) => item.organizationId === where.organizationId).length) },
    // requireRoutePermission() checks maintenance-mode (an off-by-default
    // FeatureFlag row) before evaluating any permission - stub it as
    // absent/disabled here since this test doesn't exercise that feature.
    featureFlag: { findUnique: vi.fn(async () => null) }
  }
}));

describe('health insights route', () => {
  it('returns operational counts for the current organization', async () => {
    state.vehicles = [{ organizationId: 'org-a', status: 'ANALYZED' }, { organizationId: 'org-a', status: 'NEW' }, { organizationId: 'org-b', status: 'ANALYZED' }];
    state.activityLogs = [{ organizationId: 'org-a' }, { organizationId: 'org-a' }];
    state.auditLogs = [{ organizationId: 'org-a' }];

    const sessionModule = await import('@/lib/auth/session');
    vi.mocked(sessionModule.getSession).mockResolvedValue(authMocks.dealer as any);

    const { GET } = await import('@/app/api/health/insights/route');
    const response = await GET();
    const json = await response.json();

    expect(json.ok).toBe(true);
    expect(json.data.vehicleCount).toBe(2);
    expect(json.data.analyzedCount).toBe(2);
    expect(json.data.activityCount).toBe(2);
    expect(json.data.auditCount).toBe(1);
  });
});
