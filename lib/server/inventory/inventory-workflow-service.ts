import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { AppError } from '@/lib/api/responses';

const STAGE_ORDER = ['ACQUISITION', 'PURCHASE', 'INSPECTION', 'RECONDITIONING', 'PRICING', 'PUBLISHING', 'SOLD'] as const;
export type InventoryStage = (typeof STAGE_ORDER)[number];

/** Forward transitions must follow the pipeline in order (no skipping a
 * stage); moving backward to any earlier stage is always allowed, since a
 * real intake process often needs to send a vehicle back for more work
 * (e.g. PRICING -> RECONDITIONING after a second inspection finding).
 * SOLD is a special case: a completed sale is a real, overriding business
 * event (wholesale/fleet/private-party deals routinely close without the
 * vehicle ever going through the full retail prep pipeline), so it is
 * always a valid destination regardless of the current stage. */
export function isValidStageTransition(from: InventoryStage, to: InventoryStage): boolean {
  if (to === 'SOLD') return true;
  const fromIndex = STAGE_ORDER.indexOf(from);
  const toIndex = STAGE_ORDER.indexOf(to);
  if (toIndex <= fromIndex) return true;
  return toIndex === fromIndex + 1;
}

export async function transitionVehicleStage(
  organizationId: string,
  actorUserId: string,
  vehicleId: string,
  toStage: InventoryStage
) {
  const vehicle = await db.vehicle.findFirst({ where: { id: vehicleId, organizationId } });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  if (!isValidStageTransition(vehicle.inventoryStage as InventoryStage, toStage)) {
    throw new AppError(
      `Cannot move from ${vehicle.inventoryStage} directly to ${toStage} - stages must be completed in order`,
      422,
      'INVALID_STAGE_TRANSITION'
    );
  }

  const { count } = await db.vehicle.updateMany({ where: { id: vehicleId, organizationId }, data: { inventoryStage: toStage } });
  if (count === 0) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  await writeAuditLog({
    organizationId, actorUserId, action: 'inventory_stage_transition', entityType: 'vehicle', entityId: vehicleId,
    beforeState: { inventoryStage: vehicle.inventoryStage }, afterState: { inventoryStage: toStage }
  });
  await writeActivityLog({
    organizationId, actorUserId, entityType: 'vehicle', entityId: vehicleId, type: 'vehicle.stage_changed',
    summary: `Vehicle ${vehicle.vin} moved from ${vehicle.inventoryStage} to ${toStage}`
  });

  return db.vehicle.findFirstOrThrow({ where: { id: vehicleId, organizationId } });
}
