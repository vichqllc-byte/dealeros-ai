import { requireRoutePermission } from '@/lib/server/route-auth';
import { searchManheimForOrg } from '@/lib/server/auction-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET(request: Request) {
  try {
    const auth = await requireRoutePermission('integrations.read');
    const url = new URL(request.url);
    const input = {
      query: url.searchParams.get('query') ?? undefined,
      vin: url.searchParams.get('vin') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined
    };
    const data = await searchManheimForOrg(auth.session.organizationId, input);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
