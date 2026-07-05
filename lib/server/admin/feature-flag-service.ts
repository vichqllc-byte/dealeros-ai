import { db } from '@/lib/db/client';
import { writeSuperAdminAuditLog } from '@/lib/server/admin/super-admin-audit-log';
import { getDefaultCacheClient } from '@/lib/cache/cache-client';

export const MAINTENANCE_MODE_KEY = 'maintenance_mode';

// isFeatureFlagEnabled() is consulted on every protected request (via
// requireRoutePermission/requireSession's maintenance-mode check), so a
// short cache avoids a Postgres round trip per request for a value that
// changes only when a super admin explicitly flips it.
const FLAG_CACHE_TTL_MS = 5000;
const cacheKeyFor = (key: string) => `feature-flag:${key}`;

export async function listFeatureFlags() {
  return db.featureFlag.findMany({ orderBy: { key: 'asc' } });
}

export async function setFeatureFlag(actorUserId: string, key: string, enabled: boolean, description?: string) {
  const existing = await db.featureFlag.findUnique({ where: { key } });
  const flag = await db.featureFlag.upsert({
    where: { key },
    create: { key, enabled, description },
    update: { enabled, ...(description !== undefined ? { description } : {}) }
  });

  await getDefaultCacheClient().set(cacheKeyFor(key), flag.enabled, FLAG_CACHE_TTL_MS);

  await writeSuperAdminAuditLog({
    actorUserId,
    action: existing ? 'update' : 'create',
    entityType: 'feature_flag',
    entityId: flag.id,
    beforeState: existing ?? undefined,
    afterState: flag
  });

  return flag;
}

export async function isFeatureFlagEnabled(key: string): Promise<boolean> {
  const cache = getDefaultCacheClient();
  const cached = await cache.get<boolean>(cacheKeyFor(key));
  if (cached !== undefined) return cached;

  const flag = await db.featureFlag.findUnique({ where: { key } });
  const enabled = flag?.enabled ?? false;
  await cache.set(cacheKeyFor(key), enabled, FLAG_CACHE_TTL_MS);
  return enabled;
}

export async function isMaintenanceModeEnabled(): Promise<boolean> {
  return isFeatureFlagEnabled(MAINTENANCE_MODE_KEY);
}
