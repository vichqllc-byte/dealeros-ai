import { createPortalSessionSchema } from '@/lib/validators/billing';
import { getDefaultStripeGateway, type StripeGateway } from '@/lib/billing/stripe-gateway';
import { requireStripeCustomerId } from '@/lib/server/billing/subscription-service';

export async function createBillingPortalSessionForOrg(
  organizationId: string,
  payload: unknown,
  gateway: StripeGateway = getDefaultStripeGateway()
) {
  const input = createPortalSessionSchema.parse(payload);
  const customerId = await requireStripeCustomerId(organizationId);
  const session = await gateway.createBillingPortalSession({ customerId, returnUrl: input.returnUrl });
  return { portalUrl: session.url };
}
