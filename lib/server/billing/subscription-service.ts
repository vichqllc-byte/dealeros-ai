import { db } from '@/lib/db/client';
import { AppError } from '@/lib/api/responses';
import { getPlan } from '@/lib/billing/plans';

export async function getSubscriptionForOrg(organizationId: string) {
  const subscription = await db.subscription.findUnique({ where: { organizationId } });
  if (!subscription) return null;
  return { ...subscription, plan: getPlan(subscription.planKey) };
}

export async function requireStripeCustomerId(organizationId: string): Promise<string> {
  const subscription = await db.subscription.findUnique({ where: { organizationId } });
  if (!subscription?.stripeCustomerId) {
    throw new AppError('No billing account found for this organization yet. Subscribe to a plan first.', 404, 'NOT_FOUND');
  }
  return subscription.stripeCustomerId;
}

export async function listInvoicesForOrg(organizationId: string) {
  return db.invoice.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
}
