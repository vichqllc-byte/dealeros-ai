import { db } from '@/lib/db/client';
import { registerJobHandler } from '@/lib/jobs/job-queue';
import { reportPendingUsageToStripe } from '@/lib/server/billing/usage-service';
import { createLogger } from '@/lib/logging/logger';

const logger = createLogger('job-handlers');

// Imported for its side effect (registration); importing this module more
// than once is safe since registerJobHandler just overwrites the same key.
registerJobHandler('report-usage-to-stripe', async () => {
  const subscriptions = await db.subscription.findMany({
    where: { stripeSubscriptionId: { not: null } },
    select: { organizationId: true }
  });

  for (const subscription of subscriptions) {
    try {
      await reportPendingUsageToStripe(subscription.organizationId);
    } catch (error) {
      logger.error('Failed to report usage to Stripe for organization', {
        organizationId: subscription.organizationId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
});
