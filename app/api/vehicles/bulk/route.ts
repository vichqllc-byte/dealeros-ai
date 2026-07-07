import { requireRoutePermission } from '@/lib/server/route-auth';
import { db } from '@/lib/db/client';
import { bulkVehicleUpsertSchema } from '@/lib/validators/bulk-vehicle';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.write');
    const body = await request.json();
    const input = bulkVehicleUpsertSchema.parse(body);

    const results = await Promise.all(input.items.map((item) => db.vehicle.upsert({
      where: { vin: item.vin },
      update: {
        year: item.year,
        make: item.make,
        model: item.model,
        trim: item.trim,
        mileage: item.mileage,
        workflowState: item.workflowState
      },
      create: {
        organizationId: auth.session.organizationId,
        vin: item.vin,
        year: item.year,
        make: item.make,
        model: item.model,
        trim: item.trim,
        mileage: item.mileage,
        workflowState: item.workflowState
      }
    })));

    return ok({ count: results.length, items: results }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
