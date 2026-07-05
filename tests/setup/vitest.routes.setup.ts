(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dealeros_test';
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
process.env.AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'test-only-auth-token-secret-do-not-use-in-production';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_local_tests';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder_for_local_tests';
// Fake Stripe Price IDs so checkout-flow tests can exercise the real code
// path (env var present -> id passed through) without needing a live
// Stripe account; tests that need the "unset" honest-failure path delete
// these locally within the test.
process.env.STRIPE_PRICE_STARTER_MONTHLY = process.env.STRIPE_PRICE_STARTER_MONTHLY || 'price_test_starter_monthly';
process.env.STRIPE_PRICE_STARTER_ANNUAL = process.env.STRIPE_PRICE_STARTER_ANNUAL || 'price_test_starter_annual';
process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY = process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || 'price_test_professional_monthly';
process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL = process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL || 'price_test_professional_annual';
process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY = process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || 'price_test_enterprise_monthly';
process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL = process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || 'price_test_enterprise_annual';
