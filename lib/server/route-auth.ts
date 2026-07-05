import { getSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/rbac/permissions';
import { AppError } from '@/lib/api/responses';
import { db } from '@/lib/db/client';
import { isMaintenanceModeEnabled } from '@/lib/server/admin/feature-flag-service';

async function assertNotInMaintenanceMode(userId: string) {
  if (!(await isMaintenanceModeEnabled())) return;
  const user = await db.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
  if (!user?.isSuperAdmin) {
    throw new AppError('The platform is temporarily down for maintenance. Please try again shortly.', 503, 'MAINTENANCE_MODE');
  }
}

export async function requireRoutePermission(permission: string) {
  const session = await getSession();
  if (!session) throw new AppError('Unauthorized', 401, 'AUTH_ERROR');
  await assertNotInMaintenanceMode(session.userId);
  if (!hasPermission(session.role, permission)) throw new AppError('Forbidden', 403, 'PERMISSION_ERROR');
  return { session };
}

/** For self-service "account" routes (own sessions/activity) that require
 * being logged in but aren't gated by a specific org-level permission. */
export async function requireSession() {
  const session = await getSession();
  if (!session) throw new AppError('Unauthorized', 401, 'AUTH_ERROR');
  await assertNotInMaintenanceMode(session.userId);
  return { session };
}

/**
 * Gate for the Super Admin console. Deliberately independent of
 * requireRoutePermission's org-scoped RBAC (see User.isSuperAdmin) - a
 * platform operator must ALSO hold a normal org Membership somewhere to
 * be able to log in at all (getSession() requires one), but that
 * Membership's role is unrelated to, and does not grant, super-admin
 * access. Only this flag does.
 */
export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) throw new AppError('Unauthorized', 401, 'AUTH_ERROR');
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { isSuperAdmin: true } });
  if (!user?.isSuperAdmin) throw new AppError('Forbidden', 403, 'PERMISSION_ERROR');
  return { session };
}
