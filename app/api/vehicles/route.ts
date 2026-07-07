import { requireRoutePermission } from '@/lib/server/route-auth';
import { createVehicleForOrg, listVehiclesForOrg } from '@/lib/server/vehicle-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';
import { db } from '@/lib/db/client';

export async function GET(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const query = url.searchParams.get('q');

    const data = status || query
      ? await db.vehicle.findMany({
          where: {
            organizationId: auth.session.organizationId,
            ...(status ? { status: status as any } : {}),
            ...(query
              ? {
                  OR: [
                    { vin: { contains: query, mode: 'insensitive' } },
                    { make: { contains: query, mode: 'insensitive' } },
                    { model: { contains: query, mode: 'insensitive' } }
                  ]
                }
              : {})
          },
          orderBy: { createdAt: 'desc' },
          include: { vinAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 } }
        })
      : await listVehiclesForOrg(auth.session.organizationId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.write');
    requireCsrfToken(request);
    const body = await request.json();
    const data = await createVehicleForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
