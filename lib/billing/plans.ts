import { getEnvVar } from '@/lib/vin-intelligence/providers/provider-config';
import { AppError } from '@/lib/api/responses';

export type PlanKey = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type BillingInterval = 'monthly' | 'annual';

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  seatLimit: number;
  monthlyPriceCents: number;
  annualPriceCents: number;
  stripePriceEnvVar: Record<BillingInterval, string>;
  features: string[];
};

// Prices/seat limits are DealerOS's own catalog; the referenced env vars
// hold the corresponding Stripe Price IDs created in the Stripe dashboard
// (Stripe's own recommended pattern - Price IDs are config, not something
// this app should invent or guess).
export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  STARTER: {
    key: 'STARTER',
    name: 'Starter',
    seatLimit: 3,
    monthlyPriceCents: 9900,
    annualPriceCents: 99000,
    stripePriceEnvVar: { monthly: 'STRIPE_PRICE_STARTER_MONTHLY', annual: 'STRIPE_PRICE_STARTER_ANNUAL' },
    features: ['Up to 3 team seats', 'VIN Intelligence engine', 'CRM + Inventory workflows', 'Email support']
  },
  PROFESSIONAL: {
    key: 'PROFESSIONAL',
    name: 'Professional',
    seatLimit: 15,
    monthlyPriceCents: 29900,
    annualPriceCents: 299000,
    stripePriceEnvVar: { monthly: 'STRIPE_PRICE_PROFESSIONAL_MONTHLY', annual: 'STRIPE_PRICE_PROFESSIONAL_ANNUAL' },
    features: ['Up to 15 team seats', 'Everything in Starter', 'Auction & market intelligence', 'AI Dealer Copilot', 'Priority support']
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    seatLimit: 999,
    monthlyPriceCents: 99900,
    annualPriceCents: 999000,
    stripePriceEnvVar: { monthly: 'STRIPE_PRICE_ENTERPRISE_MONTHLY', annual: 'STRIPE_PRICE_ENTERPRISE_ANNUAL' },
    features: ['Unlimited team seats', 'Everything in Professional', 'Super Admin console access', 'Dedicated onboarding']
  }
};

export function getPlan(key: string): PlanDefinition {
  const plan = PLAN_CATALOG[key as PlanKey];
  if (!plan) throw new AppError(`Unknown plan "${key}"`, 422, 'VALIDATION_ERROR');
  return plan;
}

export function listPlans(): PlanDefinition[] {
  return Object.values(PLAN_CATALOG);
}

export function getStripePriceId(planKey: string, interval: BillingInterval): string {
  const plan = getPlan(planKey);
  return getEnvVar(plan.stripePriceEnvVar[interval]);
}
