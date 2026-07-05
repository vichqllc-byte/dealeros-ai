import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb, ensureTestDatabase } from './setup/route-test-helpers';
import { recordUsageForOrg, listUsageForOrg, reportPendingUsageToStripe } from '@/lib/server/billing/usage-service';
import type { StripeGateway } from '@/lib/billing/stripe-gateway';

const dbTestsEnabled = await ensureTestDatabase();
const describeForDbTests = dbTestsEnabled ? describe : describe.skip;

function fakeGateway(overrides: Partial<StripeGateway> = {}): StripeGateway {
  return {
    createCheckoutSession: vi.fn(),
    createBillingPortalSession: vi.fn(),
    retrieveSubscription: vi.fn(async () => ({}) as never),
    cancelSubscription: vi.fn(),
    constructEvent: vi.fn(),
    createUsageRecord: vi.fn(async () => ({}) as never),
    ...overrides
  };
}

describeForDbTests('usage-based billing', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    await testDb.usageRecord.deleteMany();
    await testDb.subscription.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.organization.deleteMany();
    await testDb.organization.create({ data: { id: 'org-a', name: 'Org A' } });
  });

  it('records and lists usage for an org', async () => {
    await recordUsageForOrg('org-a', 'user-1', { metric: 'vin_analyses', quantity: 5 });
    await recordUsageForOrg('org-a', 'user-1', { metric: 'vin_analyses', quantity: 2 });
    const usage = await listUsageForOrg('org-a', 'vin_analyses');
    expect(usage).toHaveLength(2);
    expect(usage.reduce((sum, record) => sum + record.quantity, 0)).toBe(7);
  });

  it('does not report usage to Stripe when the org has no subscription yet', async () => {
    await recordUsageForOrg('org-a', 'user-1', { metric: 'vin_analyses', quantity: 5 });
    const result = await reportPendingUsageToStripe('org-a');
    expect(result.reported).toBe(0);
  });

  it('does not report usage to Stripe when the subscription has no metered price item', async () => {
    const subscription = await testDb.subscription.create({
      data: { organizationId: 'org-a', planKey: 'PROFESSIONAL', status: 'ACTIVE', stripeSubscriptionId: 'sub_1' }
    });
    await testDb.usageRecord.create({ data: { organizationId: 'org-a', subscriptionId: subscription.id, metric: 'vin_analyses', quantity: 5 } });

    const gateway = fakeGateway({
      retrieveSubscription: vi.fn(async () => ({ items: { data: [{ id: 'si_1', price: { recurring: { usage_type: 'licensed' } } }] } }) as never)
    });

    const result = await reportPendingUsageToStripe('org-a', gateway);
    expect(result.reported).toBe(0);
    expect(gateway.createUsageRecord).not.toHaveBeenCalled();
  });

  it('reports pending usage to Stripe when a metered price item exists, and marks it reported', async () => {
    const subscription = await testDb.subscription.create({
      data: { organizationId: 'org-a', planKey: 'PROFESSIONAL', status: 'ACTIVE', stripeSubscriptionId: 'sub_1' }
    });
    await testDb.usageRecord.create({ data: { organizationId: 'org-a', subscriptionId: subscription.id, metric: 'vin_analyses', quantity: 5 } });
    await testDb.usageRecord.create({ data: { organizationId: 'org-a', subscriptionId: subscription.id, metric: 'vin_analyses', quantity: 3 } });

    const gateway = fakeGateway({
      retrieveSubscription: vi.fn(async () => ({ items: { data: [{ id: 'si_1', price: { recurring: { usage_type: 'metered' } } }] } }) as never)
    });

    const result = await reportPendingUsageToStripe('org-a', gateway);
    expect(result.reported).toBe(2);
    expect(gateway.createUsageRecord).toHaveBeenCalledWith('si_1', 8, expect.any(Number));

    const stillPending = await testDb.usageRecord.count({ where: { reportedToStripe: false } });
    expect(stillPending).toBe(0);
  });
});
