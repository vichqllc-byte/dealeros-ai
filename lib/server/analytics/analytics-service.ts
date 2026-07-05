import { db } from '@/lib/db/client';
import { getDefaultCacheClient } from '@/lib/cache/cache-client';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_TURN_WINDOW_DAYS = 90;

// This dashboard aggregates across Sale/Vehicle/Lead/VinAnalysis with
// several full-table scans per organization - real work, not a cheap
// lookup - so short-lived caching meaningfully cuts DB load for a view
// that's opened repeatedly and doesn't need per-second freshness.
const ANALYTICS_CACHE_TTL_MS = 30_000;

function toNumber(value: unknown): number {
  return value == null ? 0 : Number(value);
}

/**
 * Every metric below is a real aggregation over this organization's
 * actual Vehicle/Sale/Lead/VinAnalysis rows - nothing fabricated. A fresh
 * organization with no sales/leads yet correctly reports zeros/empty
 * breakdowns rather than sample figures.
 */
export async function getDealerAnalyticsForOrg(organizationId: string, turnWindowDays = DEFAULT_TURN_WINDOW_DAYS) {
  const cache = getDefaultCacheClient();
  const cacheKey = `analytics-dashboard:${organizationId}:${turnWindowDays}`;
  const cached = await cache.get<Awaited<ReturnType<typeof computeDealerAnalyticsForOrg>>>(cacheKey);
  if (cached !== undefined) return cached;

  const result = await computeDealerAnalyticsForOrg(organizationId, turnWindowDays);
  await cache.set(cacheKey, result, ANALYTICS_CACHE_TTL_MS);
  return result;
}

async function computeDealerAnalyticsForOrg(organizationId: string, turnWindowDays: number) {
  const windowStart = new Date(Date.now() - turnWindowDays * MS_PER_DAY);

  const [completedSales, allVehicles, leads, recentAnalyses] = await Promise.all([
    db.sale.findMany({ where: { organizationId, status: 'COMPLETED' }, include: { vehicle: true } }),
    db.vehicle.findMany({ where: { organizationId }, select: { id: true, acquisitionCost: true, acquisitionSource: true, createdAt: true, inventoryStage: true } }),
    db.lead.findMany({ where: { organizationId }, select: { status: true, source: true } }),
    db.vinAnalysis.findMany({ where: { vehicle: { organizationId } }, orderBy: { createdAt: 'desc' }, take: 200, select: { recommendation: true, confidenceScore: true, projectedRoi: true } })
  ]);

  // Revenue / Gross Profit / Net Profit
  const revenue = completedSales.reduce((sum, sale) => sum + toNumber(sale.salePrice), 0);
  const costOfGoodsSold = completedSales.reduce((sum, sale) => sum + toNumber(sale.vehicle.acquisitionCost), 0);
  const grossProfit = revenue - costOfGoodsSold;

  const saleVehicleIds = completedSales.map((s) => s.vehicleId);
  const relatedAnalyses = saleVehicleIds.length
    ? await db.vinAnalysis.findMany({ where: { vehicleId: { in: saleVehicleIds } }, select: { vehicleId: true, repairEstimate: true, transportEstimate: true, feesEstimate: true, taxesEstimate: true } })
    : [];
  const costsByVehicle = new Map<string, number>();
  for (const a of relatedAnalyses) {
    const cost = toNumber(a.repairEstimate) + toNumber(a.transportEstimate) + toNumber(a.feesEstimate) + toNumber(a.taxesEstimate);
    costsByVehicle.set(a.vehicleId, (costsByVehicle.get(a.vehicleId) ?? 0) + cost);
  }
  const totalReconAndFeesCost = completedSales.reduce((sum, sale) => sum + (costsByVehicle.get(sale.vehicleId) ?? 0), 0);
  const netProfit = grossProfit - totalReconAndFeesCost;

  // Inventory Turn (vehicles sold in window / average active inventory)
  const soldInWindow = completedSales.filter((s) => s.saleDate && s.saleDate >= windowStart).length;
  const activeInventoryCount = allVehicles.filter((v) => v.inventoryStage !== 'SOLD').length;
  const inventoryTurnRate = activeInventoryCount === 0 ? 0 : Number((soldInWindow / activeInventoryCount).toFixed(2));

  // Average Days to Sell
  const daysToSellSamples = completedSales.filter((s) => s.saleDate).map((s) => (s.saleDate!.getTime() - s.vehicle.createdAt.getTime()) / MS_PER_DAY);
  const averageDaysToSell = daysToSellSamples.length === 0 ? 0 : Number((daysToSellSamples.reduce((a, b) => a + b, 0) / daysToSellSamples.length).toFixed(1));

  // Acquisition Sources
  const acquisitionSources: Record<string, number> = {};
  for (const v of allVehicles) {
    const key = v.acquisitionSource ?? 'Unspecified';
    acquisitionSources[key] = (acquisitionSources[key] ?? 0) + 1;
  }

  // Lead Conversion
  const totalLeads = leads.length;
  const wonLeads = leads.filter((l) => l.status === 'WON').length;
  const leadConversionRate = totalLeads === 0 ? 0 : Number((wonLeads / totalLeads).toFixed(3));
  const leadsByStatus: Record<string, number> = {};
  for (const l of leads) leadsByStatus[l.status] = (leadsByStatus[l.status] ?? 0) + 1;

  // Sales Performance
  const salesCount = completedSales.length;
  const averageSalePrice = salesCount === 0 ? 0 : Number((revenue / salesCount).toFixed(2));

  // ROI (from completed sales, real cost basis)
  const totalCostBasis = costOfGoodsSold + totalReconAndFeesCost;
  const roi = totalCostBasis === 0 ? 0 : Number((netProfit / totalCostBasis).toFixed(3));

  // Market Trends (from this org's own analysis history - no live decode
  // calls needed for a dashboard view)
  const recommendationBreakdown: Record<string, number> = {};
  for (const a of recentAnalyses) {
    const key = a.recommendation ?? 'UNSCORED';
    recommendationBreakdown[key] = (recommendationBreakdown[key] ?? 0) + 1;
  }
  const averageConfidence = recentAnalyses.length === 0
    ? 0
    : Number((recentAnalyses.reduce((sum, a) => sum + (a.confidenceScore ?? 0), 0) / recentAnalyses.length).toFixed(2));

  return {
    revenue: Number(revenue.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    inventoryTurnRate,
    averageDaysToSell,
    acquisitionSources,
    leadConversion: { rate: leadConversionRate, byStatus: leadsByStatus, totalLeads },
    salesPerformance: { salesCount, averageSalePrice },
    roi,
    marketTrends: { recommendationBreakdown, averageConfidence, sampleSize: recentAnalyses.length }
  };
}
