import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

const fakeCheckoutSession = { id: 'cs_test_123', url: 'https://checkout.stripe.com/test-session' };
const fakePortalSession = { url: 'https://billing.stripe.com/test-portal' };

// The routes under test call getDefaultStripeGateway() with no args (its
// default-parameter value), which would otherwise construct a real Stripe
// SDK client from the placeholder test key. Mocking this module boundary
// keeps checkout/portal route tests fast and offline while every line of
// *our* business logic (validation, RBAC, CSRF, DB writes) still runs for
// real - the same repository/DI substitution pattern used for NHTSA.
vi.mock('@/lib/billing/stripe-gateway', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/billing/stripe-gateway')>();
  return {
    ...actual,
    getDefaultStripeGateway: () => ({
      createCheckoutSession: vi.fn(async () => fakeCheckoutSession),
      createBillingPortalSession: vi.fn(async () => fakePortalSession),
      retrieveSubscription: vi.fn(async () => ({})),
      cancelSubscription: vi.fn(async () => ({})),
      constructEvent: vi.fn(() => ({})),
      createUsageRecord: vi.fn(async () => ({}))
    })
  };
});

describeForRouteTests('billing domain', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    resetAuth();
    await testDb.usageRecord.deleteMany();
    await testDb.invoice.deleteMany();
    await testDb.subscription.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    await testDb.organization.create({ data: { id: 'org-a', name: 'Org A' } });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' } });
    useSession(authMocks.dealer);
  });

  it('creates a Stripe checkout session for a new subscriber', async () => {
    const { POST } = await import('../../app/api/billing/checkout/route');
    const res = await POST(
      jsonRequest('POST', { planKey: 'PROFESSIONAL', interval: 'monthly', successUrl: 'https://app.test/success', cancelUrl: 'https://app.test/cancel' })
    );
    expect(res.status).toBe(201);
    const body = await jsonBody(res);
    expect(body.data.checkoutUrl).toBe(fakeCheckoutSession.url);
  });

  it('rejects checkout session creation for a role without billing.write', async () => {
    useSession(authMocks.vendor);
    const { POST } = await import('../../app/api/billing/checkout/route');
    const res = await POST(
      jsonRequest('POST', { planKey: 'STARTER', interval: 'monthly', successUrl: 'https://app.test/success', cancelUrl: 'https://app.test/cancel' })
    );
    expect(res.status).toBe(403);
  });

  it('rejects checkout session creation without a CSRF token', async () => {
    const { POST } = await import('../../app/api/billing/checkout/route');
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planKey: 'STARTER', interval: 'monthly', successUrl: 'https://app.test/a', cancelUrl: 'https://app.test/b' })
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects an unrecognized plan key', async () => {
    const { POST } = await import('../../app/api/billing/checkout/route');
    const res = await POST(
      jsonRequest('POST', { planKey: 'NOT_A_PLAN', interval: 'monthly', successUrl: 'https://app.test/a', cancelUrl: 'https://app.test/b' })
    );
    expect(res.status).toBe(422);
  });

  it('creates a billing portal session once a subscription exists', async () => {
    await testDb.subscription.create({ data: { organizationId: 'org-a', planKey: 'PROFESSIONAL', status: 'ACTIVE', stripeCustomerId: 'cus_test_123' } });
    const { POST } = await import('../../app/api/billing/portal/route');
    const res = await POST(jsonRequest('POST', { returnUrl: 'https://app.test/account' }));
    expect(res.status).toBe(201);
    expect((await jsonBody(res)).data.portalUrl).toBe(fakePortalSession.url);
  });

  it('rejects a portal session request before any subscription exists', async () => {
    const { POST } = await import('../../app/api/billing/portal/route');
    const res = await POST(jsonRequest('POST', { returnUrl: 'https://app.test/account' }));
    expect(res.status).toBe(404);
  });

  it('returns the current subscription and the full plan catalog', async () => {
    await testDb.subscription.create({ data: { organizationId: 'org-a', planKey: 'STARTER', status: 'TRIALING', stripeCustomerId: 'cus_test_1' } });
    const { GET } = await import('../../app/api/billing/subscription/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.subscription.plan.key).toBe('STARTER');
    expect(body.data.plans).toHaveLength(3);
  });

  it('rejects billing reads for a role without billing.read', async () => {
    useSession(authMocks.vendor);
    const { GET } = await import('../../app/api/billing/subscription/route');
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('lists invoices for the org', async () => {
    const subscription = await testDb.subscription.create({ data: { organizationId: 'org-a', planKey: 'STARTER', status: 'ACTIVE', stripeCustomerId: 'cus_test_1' } });
    await testDb.invoice.create({
      data: { organizationId: 'org-a', subscriptionId: subscription.id, stripeInvoiceId: 'in_1', status: 'PAID', amountDueCents: 9900, amountPaidCents: 9900 }
    });
    const { GET } = await import('../../app/api/billing/invoices/route');
    const res = await GET();
    expect((await jsonBody(res)).data.invoices).toHaveLength(1);
  });

  it('records usage and lists it back scoped by metric', async () => {
    const { POST } = await import('../../app/api/billing/usage/route');
    await POST(jsonRequest('POST', { metric: 'vin_analyses', quantity: 3 }));

    const { GET } = await import('../../app/api/billing/usage/route');
    const res = await GET(new Request('http://localhost/test?metric=vin_analyses'));
    const body = await jsonBody(res);
    expect(body.data.usage).toHaveLength(1);
    expect(body.data.usage[0].quantity).toBe(3);
  });

  it('rejects recording usage without a CSRF token', async () => {
    const { POST } = await import('../../app/api/billing/usage/route');
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric: 'vin_analyses', quantity: 1 })
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('rejects a Stripe webhook request without a signature header', async () => {
    const { POST } = await import('../../app/api/webhooks/stripe/route');
    const res = await POST(new Request('http://localhost/test', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(400);
  });
});
