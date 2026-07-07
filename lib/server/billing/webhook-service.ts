import type Stripe from 'stripe';
import { db } from '@/lib/db/client';
import { getEnvVar } from '@/lib/vin-intelligence/providers/provider-config';
import { getDefaultStripeGateway, type StripeGateway } from '@/lib/billing/stripe-gateway';
import { createLogger } from '@/lib/logging/logger';

type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'INCOMPLETE';
type InvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';

const logger = createLogger('stripe-webhook-service');

function subscriptionStatusFromStripe(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    case 'unpaid':
      return 'UNPAID';
    case 'incomplete':
    default:
      return 'INCOMPLETE';
  }
}

function invoiceStatusFromStripe(status: Stripe.Invoice.Status | null): InvoiceStatus {
  switch (status) {
    case 'draft':
      return 'DRAFT';
    case 'open':
      return 'OPEN';
    case 'paid':
      return 'PAID';
    case 'void':
      return 'VOID';
    case 'uncollectible':
      return 'UNCOLLECTIBLE';
    default:
      return 'OPEN';
  }
}

async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) {
    logger.warn('Stripe subscription is missing organizationId metadata; ignoring', { subscriptionId: subscription.id });
    return;
  }

  const item = subscription.items.data[0];
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  const shared = {
    status: subscriptionStatusFromStripe(subscription.status),
    seats: item?.quantity ?? 1,
    stripeSubscriptionId: subscription.id,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
  };

  await db.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      planKey: subscription.metadata?.planKey ?? 'STARTER',
      stripeCustomerId: customerId,
      ...shared
    },
    update: { stripeCustomerId: customerId, ...shared }
  });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, gateway: StripeGateway) {
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!subscriptionId) {
    logger.warn('checkout.session.completed had no subscription id; ignoring', { sessionId: session.id });
    return;
  }
  const subscription = await gateway.retrieveSubscription(subscriptionId);
  await upsertSubscriptionFromStripe(subscription);
}

async function resolveOrganizationIdForInvoice(invoice: Stripe.Invoice): Promise<string | null> {
  const metadataOrgId = invoice.subscription_details?.metadata?.organizationId;
  if (metadataOrgId) return metadataOrgId;

  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  if (!subscriptionId) return null;
  const local = await db.subscription.findUnique({ where: { stripeSubscriptionId: subscriptionId } });
  return local?.organizationId ?? null;
}

async function upsertInvoiceFromStripe(invoice: Stripe.Invoice) {
  const organizationId = await resolveOrganizationIdForInvoice(invoice);
  if (!organizationId || !invoice.id) {
    logger.warn('Stripe invoice could not be linked to an organization; ignoring', { invoiceId: invoice.id });
    return;
  }

  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  const localSubscription = subscriptionId
    ? await db.subscription.findUnique({ where: { stripeSubscriptionId: subscriptionId } })
    : null;

  const shared = {
    status: invoiceStatusFromStripe(invoice.status),
    amountDueCents: invoice.amount_due,
    amountPaidCents: invoice.amount_paid,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice.invoice_pdf ?? null
  };

  await db.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      organizationId,
      subscriptionId: localSubscription?.id,
      stripeInvoiceId: invoice.id,
      currency: invoice.currency,
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      ...shared
    },
    update: shared
  });
}

export async function handleStripeWebhookEvent(
  rawBody: string,
  signature: string,
  gateway: StripeGateway = getDefaultStripeGateway()
) {
  const secret = getEnvVar('STRIPE_WEBHOOK_SECRET');
  const event = gateway.constructEvent(rawBody, signature, secret);

  // Stripe may redeliver the same event at least once; this ledger makes
  // every handler above safe to run more than once for the same event.
  const alreadyProcessed = await db.stripeWebhookEvent.findUnique({ where: { id: event.id } });
  if (alreadyProcessed) {
    logger.info('Ignoring duplicate Stripe webhook event', { eventId: event.id, type: event.type });
    return { deduped: true as const, type: event.type };
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, gateway);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.finalized':
    case 'invoice.updated':
      await upsertInvoiceFromStripe(event.data.object as Stripe.Invoice);
      break;
    default:
      logger.info('Unhandled Stripe webhook event type', { type: event.type });
  }

  await db.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
  return { deduped: false as const, type: event.type };
}
