import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(async () => null)
}));

describe('route auth', () => {
  it('denies when no session exists', async () => {
    const { requireRoutePermission } = await import('@/lib/server/route-auth');
    await expect(requireRoutePermission('vehicles.read')).rejects.toMatchObject({ status: 401 });
  });
});
