import { db } from '@/lib/db/client';
import { isStripeConfigured } from '@/lib/billing/stripe-gateway';
import { isProviderConfigured, type ProviderKey } from '@/lib/vin-intelligence/providers/provider-config';

const VIN_PROVIDER_KEYS: ProviderKey[] = [
  'nmvtis', 'carfax', 'autocheck', 'blackBook', 'jdPower', 'kbb', 'manheimMmr',
  'edmunds', 'copart', 'iaai', 'autoAuctionServices', 'esign'
];

export async function getProviderStatus() {
  const status: Record<string, boolean> = { stripe: isStripeConfigured() };
  for (const key of VIN_PROVIDER_KEYS) status[key] = isProviderConfigured(key);
  return status;
}

export async function getSystemHealth() {
  const dbStartedAt = Date.now();
  let dbHealthy = true;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbHealthy = false;
  }
  const dbLatencyMs = Date.now() - dbStartedAt;

  const [organizationCount, userCount, activeSessionCount] = await Promise.all([
    db.organization.count(),
    db.user.count(),
    db.session.count({ where: { revokedAt: null, accessExpiresAt: { gte: new Date() } } })
  ]);

  return {
    database: { healthy: dbHealthy, latencyMs: dbLatencyMs },
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
    },
    counts: { organizationCount, userCount, activeSessionCount },
    providers: await getProviderStatus()
  };
}
