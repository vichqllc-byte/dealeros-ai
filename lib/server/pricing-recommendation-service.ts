import { db } from '@/lib/db/client';
import { buildPricingRecommendation } from '@/lib/ai/pricing-recommendations';

export async function getPricingRecommendationForVehicle(organizationId: string, vehicleId: string) {
  const vehicle = await db.vehicle.findFirst({
    where: { id: vehicleId, organizationId },
    include: { vinAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });

  if (!vehicle) return null;
  const analysis = vehicle.vinAnalyses[0];
  if (!analysis) return null;

  const recommendation = buildPricingRecommendation({
    retailValue: Number(analysis.retailValue ?? 0),
    wholesaleValue: Number(analysis.wholesaleValue ?? 0),
    repairEstimate: Number(analysis.repairEstimate ?? 0),
    transportEstimate: Number(analysis.transportEstimate ?? 0),
    feesEstimate: Number(analysis.feesEstimate ?? 0),
    confidenceScore: Number(analysis.confidenceScore ?? 0.6)
  });

  return {
    vehicleId: vehicle.id,
    vin: vehicle.vin,
    recommendation
  };
}
