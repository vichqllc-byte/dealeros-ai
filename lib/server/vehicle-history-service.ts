import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { AppError } from '@/lib/api/responses';
import { InternalHistoryProvider, type InternalAnalysisRecord } from '@/lib/vin-intelligence/providers/vehicle-history/internal-history-provider';
import { VehicleHistoryService, createDefaultVehicleHistoryProviders } from '@/lib/vin-intelligence/providers/vehicle-history/vehicle-history-service';
import type { VehicleHistoryReport } from '@/lib/vin-intelligence/providers/vehicle-history/types';

function extractMileage(decodedPayload: Prisma.JsonValue): number | null {
  if (decodedPayload && typeof decodedPayload === 'object' && !Array.isArray(decodedPayload)) {
    const value = (decodedPayload as Record<string, unknown>).mileageAtAnalysis;
    if (typeof value === 'number') return value;
  }
  return null;
}

/** Builds a full vehicle history report for an org-owned vehicle by
 * combining our own real internal record-keeping with every configured
 * commercial title-history provider. */
export async function getVehicleHistoryReport(organizationId: string, vehicleId: string): Promise<VehicleHistoryReport> {
  const vehicle = await db.vehicle.findFirst({ where: { id: vehicleId, organizationId } });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  const priorAnalyses = await db.vinAnalysis.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, decodedPayload: true, marketValue: true }
  });

  const internalRecords: InternalAnalysisRecord[] = priorAnalyses.map((a) => ({
    createdAt: a.createdAt,
    mileage: extractMileage(a.decodedPayload),
    marketValue: a.marketValue ? Number(a.marketValue) : null
  }));

  const internalProvider = new InternalHistoryProvider(internalRecords);
  const providers = createDefaultVehicleHistoryProviders(internalProvider);
  const service = new VehicleHistoryService(providers);

  return service.buildReport({ vin: vehicle.vin, make: vehicle.make, model: vehicle.model, modelYear: vehicle.year });
}
