import { describe, expect, it, vi } from 'vitest';
import { authMocks } from '@/lib/test/auth-mocks';

vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }));

describe('route auth execution', () => {
  it('allows dealer vehicle permission', async () => {
    const sessionModule = await import('@/lib/auth/session');
    vi.mocked(sessionModule.getSession).mockResolvedValue(authMocks.dealer as any);
    const { requireRoutePermission } = await import('@/lib/server/route-auth');
    const result = await requireRoutePermission('vehicles.write');
    expect(result.session.role).toBe('DEALER_OWNER');
  });

  it('denies vendor dealer-only permission', async () => {
    const sessionModule = await import('@/lib/auth/session');
    vi.mocked(sessionModule.getSession).mockResolvedValue(authMocks.vendor as any);
    const { requireRoutePermission } = await import('@/lib/server/route-auth');
    await expect(requireRoutePermission('vehicles.write')).rejects.toMatchObject({ status: 403 });
  });

  it('allows admin permissions', async () => {
    const sessionModule = await import('@/lib/auth/session');
    vi.mocked(sessionModule.getSession).mockResolvedValue(authMocks.admin as any);
    const { requireRoutePermission } = await import('@/lib/server/route-auth');
    const result = await requireRoutePermission('audit.read');
    expect(result.session.role).toBe('ADMIN');
  });

  it('denies unauthenticated access', async () => {
    const sessionModule = await import('@/lib/auth/session');
    vi.mocked(sessionModule.getSession).mockResolvedValue(authMocks.none as any);
    const { requireRoutePermission } = await import('@/lib/server/route-auth');
    await expect(requireRoutePermission('vehicles.read')).rejects.toMatchObject({ status: 401 });
  });
});
