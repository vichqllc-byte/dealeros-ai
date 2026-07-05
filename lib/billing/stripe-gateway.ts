import Stripe from 'stripe';
import { getEnvVar } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';

/**
 * Thin boundary around the real Stripe SDK, following the same
 * repository/DI pattern used by lib/vin-intelligence: business logic
 * depends only on this interface, so tests substitute a fake gateway at
 * the true network boundary while the checkout/subscription/webhook
 * logic that consumes it runs for real. Stripe's request/response shapes
 * below are the actual documented Checkout/Billing/Webhooks API contracts
 * (not guessed) - what's missing in this environment is a real
 * STRIPE_SECRET_KEY, not correctness of the integration.
 */

export type CreateCheckoutSessionInput = {
  customerId?: string;
  customerEmail?: string;
  priceId: string;
  organizationId: string;
  planKey: string;
  successUrl: string;
  cancelUrl: string;
  trialPeriodDays?: number;
};

export type CreateBillingPortalInput = {
  customerId: string;
  returnUrl: string;
};

export interface StripeGateway {
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<Stripe.Checkout.Session>;
  createBillingPortalSession(input: CreateBillingPortalInput): Promise<Stripe.BillingPortal.Session>;
  retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
  cancelSubscription(subscriptionId: string, atPeriodEnd: boolean): Promise<Stripe.Subscription>;
  constructEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event;
  createUsageRecord(subscriptionItemId: string, quantity: number, timestampSeconds: number): Promise<Stripe.UsageRecord>;
}

export class RealStripeGateway implements StripeGateway {
  constructor(private readonly client: Stripe) {}

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<Stripe.Checkout.Session> {
    return this.client.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: input.priceId, quantity: 1 }],
      customer: input.customerId,
      customer_email: input.customerId ? undefined : input.customerEmail,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      allow_promotion_codes: true,
      client_reference_id: input.organizationId,
      subscription_data: {
        metadata: { organizationId: input.organizationId, planKey: input.planKey },
        ...(input.trialPeriodDays ? { trial_period_days: input.trialPeriodDays } : {})
      },
      metadata: { organizationId: input.organizationId, planKey: input.planKey }
    });
  }

  async createBillingPortalSession(input: CreateBillingPortalInput): Promise<Stripe.BillingPortal.Session> {
    return this.client.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl
    });
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.client.subscriptions.retrieve(subscriptionId);
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean): Promise<Stripe.Subscription> {
    if (atPeriodEnd) {
      return this.client.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    }
    return this.client.subscriptions.cancel(subscriptionId);
  }

  constructEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    return this.client.webhooks.constructEvent(payload, signature, secret);
  }

  async createUsageRecord(subscriptionItemId: string, quantity: number, timestampSeconds: number): Promise<Stripe.UsageRecord> {
    return this.client.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity,
      timestamp: timestampSeconds,
      action: 'increment'
    });
  }
}

let cachedClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getDefaultStripeGateway(): StripeGateway {
  if (!isStripeConfigured()) {
    throw new ProviderNotConfiguredError('Stripe', ['STRIPE_SECRET_KEY']);
  }
  if (!cachedClient) {
    cachedClient = new Stripe(getEnvVar('STRIPE_SECRET_KEY'));
  }
  return new RealStripeGateway(cachedClient);
}
