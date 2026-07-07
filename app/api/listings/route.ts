import { requireRoutePermission } from '@/lib/server/route-auth';
import { createAndPublishListing, listListingsForOrg } from '@/lib/server/marketplace-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('marketplace.write');
    const data = await listListingsForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('marketplace.write');
    const body = await request.json();
    const data = await createAndPublishListing(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
