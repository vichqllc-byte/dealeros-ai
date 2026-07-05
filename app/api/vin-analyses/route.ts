import { requireRoutePermission } from '@/lib/server/route-auth';
import { createVinAnalysisForOrg, listVinAnalysesForOrg } from '@/lib/server/vin-analysis-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const data = await listVinAnalysesForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('vin.write');
    const body = await request.json();
    const data = await createVinAnalysisForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
