import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb, ensureTestDatabase } from './setup/route-test-helpers';
import { handleStripeWebhookEvent } from '@/lib/server/billing/webhook-service';
import type { StripeGateway } from '@/lib/billing/stripe-gateway';

const dbTestsEnabled = await ensureTestDatabase();
const describeForDbTests = dbTestsEnabled ? describe : describe.skip;

function fakeGateway(overrides: Partial<StripeGateway> = {}): StripeGateway {
  return {
    createCheckoutSession: vi.fn(),
    createBillingPortalSession: vi.fn(),
    retrieveSubscription: vi.fn(async () => ({}) as never),
    cancelSubscription: vi.fn(),
    constructEvent: vi.fn(() => ({}) as never),
    createUsageRecord: vi.fn(),
    ...overrides
  };
}

describeForDbTests('Stripe webhook processing', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    await testDb.stripeWebhookEvent.deleteMany();
    await testDb.invoice.deleteMany();
    await testDb.usageRecord.deleteMany();
    await testDb.subscription.deleteMany();
    await testDb.organization.deleteMany();
    await testDb.organization.create({ data: { id: 'org-a', name: 'Org A' } });
  });

  it('creates a subscription from checkout.session.completed', async () => {
    const gateway = fakeGateway({
      constructEvent: vi.fn(
        () =>
          ({
            id: 'evt_1',
            type: 'checkout.session.completed',
            data: { object: { id: 'cs_1', subscription: 'sub_1', customer: 'cus_1' } }
          }) as never
      ),
      retrieveSubscription: vi.fn(
        async () =>
          ({
            id: 'sub_1',
            status: 'trialing',
            customer: 'cus_1',
            items: { data: [{ quantity: 1 }] },
            current_period_start: 1_700_000_000,
            current_period_end: 1_702_600_000,
            cancel_at_period_end: false,
            trial_end: 1_701_000_000,
            metadata: { organizationId: 'org-a', planKey: 'PROFESSIONAL' }
          }) as never
      )
    });

    await handleStripeWebhookEvent('raw-body', 'sig', gateway);

    const subscription = await testDb.subscription.findUnique({ where: { organizationId: 'org-a' } });
    expect(subscription?.status).toBe('TRIALING');
    expect(subscription?.planKey).toBe('PROFESSIONAL');
    expect(subscription?.stripeCustomerId).toBe('cus_1');
    expect(subscription?.trialEndsAt).toBeTruthy();
  });

  it('updates subscription status/seats on customer.subscription.updated', async () => {
    await testDb.subscription.create({
      data: { organizationId: 'org-a', planKey: 'STARTER', status: 'TRIALING', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' }
    });

    const gateway = fakeGateway({
      constructEvent: vi.fn(
        () =>
          ({
            id: 'evt_2',
            type: 'customer.subscription.updated',
            data: {
              object: {
                id: 'sub_1',
                status: 'active',
                customer: 'cus_1',
                items: { data: [{ quantity: 3 }] },
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_600_000,
                cancel_at_period_end: false,
                trial_end: null,
                metadata: { organizationId: 'org-a', planKey: 'STARTER' }
              }
            }
          }) as never
      )
    });

    await handleStripeWebhookEvent('raw-body', 'sig', gateway);
    const subscription = await testDb.subscription.findUnique({ where: { organizationId: 'org-a' } });
    expect(subscription?.status).toBe('ACTIVE');
    expect(subscription?.seats).toBe(3);
  });

  it('marks a subscription canceled on customer.subscription.deleted', async () => {
    await testDb.subscription.create({
      data: { organizationId: 'org-a', planKey: 'STARTER', status: 'ACTIVE', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' }
    });

    const gateway = fakeGateway({
      constructEvent: vi.fn(
        () =>
          ({
            id: 'evt_3',
            type: 'customer.subscription.deleted',
            data: {
              object: {
                id: 'sub_1',
                status: 'canceled',
                customer: 'cus_1',
                items: { data: [{ quantity: 1 }] },
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_600_000,
                cancel_at_period_end: true,
                trial_end: null,
                metadata: { organizationId: 'org-a', planKey: 'STARTER' }
              }
            }
          }) as never
      )
    });

    await handleStripeWebhookEvent('raw-body', 'sig', gateway);
    const subscription = await testDb.subscription.findUnique({ where: { organizationId: 'org-a' } });
    expect(subscription?.status).toBe('CANCELED');
  });

  it('records a paid invoice, linking it to the local subscription', async () => {
    await testDb.subscription.create({
      data: { organizationId: 'org-a', planKey: 'STARTER', status: 'ACTIVE', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' }
    });

    const gateway = fakeGateway({
      constructEvent: vi.fn(
        () =>
          ({
            id: 'evt_4',
            type: 'invoice.paid',
            data: {
              object: {
                id: 'in_1',
                status: 'paid',
                amount_due: 9900,
                amount_paid: 9900,
                currency: 'usd',
                hosted_invoice_url: 'https://stripe.test/invoice',
                invoice_pdf: 'https://stripe.test/invoice.pdf',
                period_start: 1_700_000_000,
                period_end: 1_702_600_000,
                subscription: 'sub_1',
                subscription_details: { metadata: { organizationId: 'org-a' } }
              }
            }
          }) as never
      )
    });

    await handleStripeWebhookEvent('raw-body', 'sig', gateway);
    const invoice = await testDb.invoice.findUnique({ where: { stripeInvoiceId: 'in_1' } });
    expect(invoice?.status).toBe('PAID');
    expect(invoice?.amountPaidCents).toBe(9900);
  });

  it('resolves the organization for an invoice via the local subscription when metadata is absent', async () => {
    await testDb.subscription.create({
      data: { organizationId: 'org-a', planKey: 'STARTER', status: 'ACTIVE', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' }
    });

    const gateway = fakeGateway({
      constructEvent: vi.fn(
        () =>
          ({
            id: 'evt_4b',
            type: 'invoice.paid',
            data: {
              object: {
                id: 'in_2',
                status: 'paid',
                amount_due: 5000,
                amount_paid: 5000,
                currency: 'usd',
                subscription: 'sub_1'
              }
            }
          }) as never
      )
    });

    await handleStripeWebhookEvent('raw-body', 'sig', gateway);
    const invoice = await testDb.invoice.findUnique({ where: { stripeInvoiceId: 'in_2' } });
    expect(invoice?.organizationId).toBe('org-a');
  });

  it('is idempotent: redelivering the same event id does not reprocess it', async () => {
    const gateway = fakeGateway({
      constructEvent: vi.fn(
        () =>
          ({
            id: 'evt_5',
            type: 'checkout.session.completed',
            data: { object: { id: 'cs_2', subscription: 'sub_2', customer: 'cus_2' } }
          }) as never
      ),
      retrieveSubscription: vi.fn(
        async () =>
          ({
            id: 'sub_2',
            status: 'active',
            customer: 'cus_2',
            items: { data: [{ quantity: 1 }] },
            current_period_start: 1_700_000_000,
            current_period_end: 1_702_600_000,
            cancel_at_period_end: false,
            trial_end: null,
            metadata: { organizationId: 'org-a', planKey: 'STARTER' }
          }) as never
      )
    });

    const first = await handleStripeWebhookEvent('raw-body', 'sig', gateway);
    const second = await handleStripeWebhookEvent('raw-body', 'sig', gateway);
    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(gateway.retrieveSubscription).toHaveBeenCalledTimes(1);
  });

  it('ignores a subscription event with no organizationId metadata', async () => {
    const gateway = fakeGateway({
      constructEvent: vi.fn(
        () =>
          ({
            id: 'evt_6',
            type: 'customer.subscription.updated',
            data: {
              object: {
                id: 'sub_9',
                status: 'active',
                customer: 'cus_9',
                items: { data: [{ quantity: 1 }] },
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_600_000,
                cancel_at_period_end: false,
                trial_end: null,
                metadata: {}
              }
            }
          }) as never
      )
    });

    await expect(handleStripeWebhookEvent('raw-body', 'sig', gateway)).resolves.toMatchObject({ deduped: false });
    expect(await testDb.subscription.count()).toBe(0);
  });
});
