import { requireRoutePermission } from '@/lib/server/route-auth';
import { createCustomerForOrg, listCustomersForOrg } from '@/lib/server/customer-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('customers.read');
    const data = await listCustomersForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('customers.write');
    const body = await request.json();
    const data = await createCustomerForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
