import { db } from '@/lib/db/client';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Real aggregation over this organization's actual vehicle inventory - no
 * fabricated figures. On a fresh organization with no vehicles, every
 * metric below is a genuine (accurate) zero-state. */
export async function getInventoryAnalyticsForOrg(organizationId: string) {
  const vehicles = await db.vehicle.findMany({
    where: { organizationId },
    select: { id: true, vin: true, inventoryStage: true, createdAt: true }
  });

  const countByStage: Record<string, number> = {};
  for (const vehicle of vehicles) {
    countByStage[vehicle.inventoryStage] = (countByStage[vehicle.inventoryStage] ?? 0) + 1;
  }

  const activeVehicles = vehicles.filter((v) => v.inventoryStage !== 'SOLD');
  const now = Date.now();
  const ageInDays = (createdAt: Date) => (now - createdAt.getTime()) / MS_PER_DAY;

  const averageDaysInInventory = activeVehicles.length === 0
    ? 0
    : Number((activeVehicles.reduce((sum, v) => sum + ageInDays(v.createdAt), 0) / activeVehicles.length).toFixed(1));

  const agingInventory = activeVehicles
    .map((v) => ({ id: v.id, vin: v.vin, stage: v.inventoryStage, daysInInventory: Number(ageInDays(v.createdAt).toFixed(1)) }))
    .sort((a, b) => b.daysInInventory - a.daysInInventory)
    .slice(0, 20);

  return {
    totalVehicles: vehicles.length,
    activeVehicles: activeVehicles.length,
    countByStage,
    averageDaysInInventory,
    agingInventory
  };
}
