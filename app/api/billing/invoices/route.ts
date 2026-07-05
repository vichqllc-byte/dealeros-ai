import { requireRoutePermission } from '@/lib/server/route-auth';
import { listInvoicesForOrg } from '@/lib/server/billing/subscription-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('billing.read');
    const invoices = await listInvoicesForOrg(auth.session.organizationId);
    return ok({ invoices });
  } catch (error) {
    return handleRouteError(error);
  }
}
