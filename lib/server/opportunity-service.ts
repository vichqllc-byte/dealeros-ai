import { db } from '@/lib/db/client';
import { buildOpportunityInsight } from '@/lib/ai/opportunity-scoring';

export async function listOpportunitySummariesForOrg(organizationId: string) {
  const vehicles = await db.vehicle.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: { vinAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });

  return vehicles.map((vehicle) => {
    const latestAnalysis = vehicle.vinAnalyses[0];
    const insight = buildOpportunityInsight(vehicle, latestAnalysis);
    return {
      id: vehicle.id,
      vin: vehicle.vin,
      status: vehicle.status,
      score: insight.score,
      label: insight.label,
      summary: insight.summary,
      reasons: insight.reasons,
      recommendation: latestAnalysis?.recommendation ?? null,
      projectedRoi: latestAnalysis?.projectedRoi ? Number(latestAnalysis.projectedRoi) : null
    };
  });
}
