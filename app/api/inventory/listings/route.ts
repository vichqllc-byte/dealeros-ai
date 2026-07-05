import { requireRoutePermission } from '@/lib/server/route-auth';
import { createListingForOrg, listListingsForOrg } from '@/lib/server/inventory/listing-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const vehicleId = new URL(request.url).searchParams.get('vehicleId') ?? undefined;
    const data = await listListingsForOrg(auth.session.organizationId, vehicleId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.write');
    const body = await request.json();
    const data = await createListingForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
