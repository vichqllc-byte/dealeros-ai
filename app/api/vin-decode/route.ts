import { requireRoutePermission } from '@/lib/server/route-auth';
import { decodeVinPayload } from '@/lib/server/vin-decoder-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function POST(request: Request) {
  try {
    await requireRoutePermission('vin.write');
    const body = await request.json();
    const data = await decodeVinPayload(body);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
