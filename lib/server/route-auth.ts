import { getSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/rbac/permissions';
import { AppError } from '@/lib/api/responses';

export async function requireRoutePermission(permission: string) {
  const session = await getSession();
  if (!session) throw new AppError('Unauthorized', 401, 'AUTH_ERROR');
  if (!hasPermission(session.role, permission)) throw new AppError('Forbidden', 403, 'PERMISSION_ERROR');
  return { session };
}

/** For self-service "account" routes (own sessions/activity) that require
 * being logged in but aren't gated by a specific org-level permission. */
export async function requireSession() {
  const session = await getSession();
  if (!session) throw new AppError('Unauthorized', 401, 'AUTH_ERROR');
  return { session };
}
