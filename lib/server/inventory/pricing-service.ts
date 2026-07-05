import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createPriceRecordSchema } from '@/lib/validators/inventory';
import { AppError } from '@/lib/api/responses';
import { transitionVehicleStage } from '@/lib/server/inventory/inventory-workflow-service';

export async function listPriceRecordsForOrg(organizationId: string, vehicleId?: string) {
  return db.priceRecord.findMany({ where: { organizationId, ...(vehicleId ? { vehicleId } : {}) }, orderBy: { createdAt: 'desc' } });
}

/** Setting a price completes the Pricing workflow step and advances the
 * vehicle to Publishing. */
export async function createPriceRecordForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createPriceRecordSchema.parse(payload);
  const vehicle = await db.vehicle.findFirst({ where: { id: input.vehicleId, organizationId } });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  const record = await db.priceRecord.create({ data: { ...input, organizationId, setByUserId: actorUserId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'price_record', entityId: record.id, afterState: record });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'price_record', entityId: record.id, type: 'pricing.set', summary: `Price set for ${vehicle.vin}: $${input.price.toLocaleString()}`, payload: record });

  await transitionVehicleStage(organizationId, actorUserId, input.vehicleId, 'PUBLISHING');
  return record;
}
