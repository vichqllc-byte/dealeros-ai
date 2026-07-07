import { db } from '@/lib/db/client';
import { buildAuctionCalculatorResults } from '@/lib/ai/auction-calculator';
import { buildPricingSummary } from '@/lib/ai/pricing-summary';

export async function getVehicleValuationForOrg(organizationId: string, vehicleId: string) {
  const vehicle = await db.vehicle.findFirst({
    where: { id: vehicleId, organizationId },
    include: { vinAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });

  if (!vehicle) return null;

  const analysis = vehicle.vinAnalyses[0];
  const purchasePrice = Number(analysis?.wholesaleValue ?? 0);
  const repairEstimate = Number(analysis?.repairEstimate ?? 0);
  const transportCost = Number(analysis?.transportEstimate ?? 0);
  const auctionFees = Number(analysis?.feesEstimate ?? 0);
  const expectedRetailPrice = Number(analysis?.retailValue ?? 0);

  const auction = buildAuctionCalculatorResults([
    {
      id: vehicle.id,
      title: `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim() || vehicle.vin,
      purchasePrice,
      repairEstimate,
      transportCost,
      auctionFees,
      expectedRetailPrice,
      demandScore: analysis?.confidenceScore ?? 0.7
    }
  ])[0];

  const pricing = buildPricingSummary([
    {
      title: auction.title,
      retailPrice: expectedRetailPrice,
      repairCost: repairEstimate,
      transportCost,
      fees: auctionFees
    }
  ])[0];

  return {
    vehicleId: vehicle.id,
    vin: vehicle.vin,
    auction,
    pricing,
    analysis: analysis
      ? {
          recommendation: analysis.recommendation,
          projectedRoi: Number(analysis.projectedRoi ?? 0),
          confidenceScore: analysis.confidenceScore
        }
      : null
  };
}
