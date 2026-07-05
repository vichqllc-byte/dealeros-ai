import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { createCheckoutSessionSchema } from '@/lib/validators/billing';
import { getStripePriceId } from '@/lib/billing/plans';
import { getDefaultStripeGateway, type StripeGateway } from '@/lib/billing/stripe-gateway';
import { AppError } from '@/lib/api/responses';

const NEW_SUBSCRIBER_TRIAL_DAYS = 14;

export async function createCheckoutSessionForOrg(
  organizationId: string,
  actorUserId: string,
  actorEmail: string,
  payload: unknown,
  gateway: StripeGateway = getDefaultStripeGateway()
) {
  const input = createCheckoutSessionSchema.parse(payload);
  const priceId = getStripePriceId(input.planKey, input.interval);
  const existing = await db.subscription.findUnique({ where: { organizationId } });

  const session = await gateway.createCheckoutSession({
    customerId: existing?.stripeCustomerId ?? undefined,
    customerEmail: existing?.stripeCustomerId ? undefined : actorEmail,
    priceId,
    organizationId,
    planKey: input.planKey,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    trialPeriodDays: existing ? undefined : NEW_SUBSCRIBER_TRIAL_DAYS
  });

  if (!session.url) {
    throw new AppError('Stripe did not return a checkout URL', 502, 'PROVIDER_ERROR');
  }

  await writeAuditLog({
    organizationId,
    actorUserId,
    action: 'create',
    entityType: 'checkout_session',
    entityId: session.id,
    afterState: { planKey: input.planKey, interval: input.interval }
  });

  return { checkoutUrl: session.url };
}
