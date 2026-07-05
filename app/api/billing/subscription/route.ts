import { requireRoutePermission } from '@/lib/server/route-auth';
import { getSubscriptionForOrg } from '@/lib/server/billing/subscription-service';
import { listPlans } from '@/lib/billing/plans';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('billing.read');
    const subscription = await getSubscriptionForOrg(auth.session.organizationId);
    return ok({ subscription, plans: listPlans() });
  } catch (error) {
    return handleRouteError(error);
  }
}
