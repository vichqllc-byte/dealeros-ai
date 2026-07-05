import { db } from '@/lib/db/client';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { recordUsageSchema } from '@/lib/validators/billing';
import { createLogger } from '@/lib/logging/logger';
import { getDefaultStripeGateway, type StripeGateway } from '@/lib/billing/stripe-gateway';

const logger = createLogger('usage-service');

export async function recordUsageForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = recordUsageSchema.parse(payload);
  const subscription = await db.subscription.findUnique({ where: { organizationId } });
  const usage = await db.usageRecord.create({
    data: { organizationId, subscriptionId: subscription?.id, metric: input.metric, quantity: input.quantity }
  });
  await writeActivityLog({
    organizationId,
    actorUserId,
    entityType: 'usage_record',
    entityId: usage.id,
    type: 'usage.recorded',
    summary: `Recorded ${input.quantity} unit(s) of ${input.metric}`
  });
  return usage;
}

export async function listUsageForOrg(organizationId: string, metric?: string) {
  return db.usageRecord.findMany({
    where: { organizationId, ...(metric ? { metric } : {}) },
    orderBy: { recordedAt: 'desc' }
  });
}

/**
 * Reports unreported usage to Stripe's metered-billing API for orgs whose
 * subscription carries a metered line item. Orgs on flat-rate plans (no
 * metered item on the Stripe subscription) simply keep their usage as a
 * local record for reporting/analytics - this only calls Stripe when a
 * metered item genuinely exists, it never fabricates one.
 */
export async function reportPendingUsageToStripe(
  organizationId: string,
  gateway: StripeGateway = getDefaultStripeGateway()
) {
  const subscription = await db.subscription.findUnique({ where: { organizationId } });
  if (!subscription?.stripeSubscriptionId) return { reported: 0 };

  const stripeSubscription = await gateway.retrieveSubscription(subscription.stripeSubscriptionId);
  const meteredItem = stripeSubscription.items.data.find((item) => item.price.recurring?.usage_type === 'metered');
  if (!meteredItem) return { reported: 0 };

  const pending = await db.usageRecord.findMany({
    where: { organizationId, subscriptionId: subscription.id, reportedToStripe: false }
  });
  if (pending.length === 0) return { reported: 0 };

  const totalQuantity = pending.reduce((sum, record) => sum + record.quantity, 0);
  await gateway.createUsageRecord(meteredItem.id, totalQuantity, Math.floor(Date.now() / 1000));
  await db.usageRecord.updateMany({
    where: { id: { in: pending.map((record) => record.id) } },
    data: { reportedToStripe: true }
  });

  logger.info('Reported usage to Stripe', { organizationId, totalQuantity, recordCount: pending.length });
  return { reported: pending.length };
}
