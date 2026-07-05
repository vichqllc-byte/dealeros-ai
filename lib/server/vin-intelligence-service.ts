import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { AppError } from '@/lib/api/responses';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { analyzeVinSchema } from '@/lib/validators/vin-intelligence';
import { vinIntelligenceOrchestrator, type VinIntelligenceOrchestrator, type VinIntelligenceReport } from '@/lib/vin-intelligence/vin-intelligence-orchestrator';
import { createLogger } from '@/lib/logging/logger';

const logger = createLogger('vin-intelligence-db-service');

function extractPriorMileage(decodedPayload: Prisma.JsonValue): number | null {
  if (decodedPayload && typeof decodedPayload === 'object' && !Array.isArray(decodedPayload)) {
    const value = (decodedPayload as Record<string, unknown>).mileageAtAnalysis;
    if (typeof value === 'number') return value;
  }
  return null;
}

/**
 * Runs the full real VIN intelligence pipeline for a vehicle already owned
 * by the caller's organization, persists the result as a VinAnalysis, and
 * records the audit/activity trail - the same tenant-scoping and logging
 * discipline established in Phases 2-3.
 */
export async function analyzeVehicleVin(
  organizationId: string,
  actorUserId: string,
  payload: unknown,
  orchestrator: VinIntelligenceOrchestrator = vinIntelligenceOrchestrator
) {
  const input = analyzeVinSchema.parse(payload);

  const vehicle = await db.vehicle.findFirst({ where: { id: input.vehicleId, organizationId } });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  const priorAnalyses = await db.vinAnalysis.findMany({
    where: { vehicleId: vehicle.id },
    select: { decodedPayload: true }
  });
  const priorMileageReadings = [
    vehicle.mileage,
    ...priorAnalyses.map((a) => extractPriorMileage(a.decodedPayload))
  ].filter((value): value is number => value != null);

  let report: VinIntelligenceReport;
  try {
    report = await orchestrator.analyze({
      vin: input.vin,
      mileageMiles: input.mileage,
      manualMake: input.manualMake ?? vehicle.make,
      manualModel: input.manualModel ?? vehicle.model,
      manualYear: input.manualYear ?? vehicle.year,
      priorMileageReadings,
      damageReports: input.damageReports,
      acquisitionCost: input.acquisitionCost,
      transportCost: input.transportCost,
      auctionFees: input.auctionFees,
      taxesCost: input.taxesCost,
      demandScore: input.demandScore
    });
  } catch (error) {
    logger.error('VIN intelligence analysis failed', { vin: input.vin, error: error instanceof Error ? error.message : String(error) });
    throw new AppError(error instanceof Error ? error.message : 'VIN analysis failed', 502, 'VIN_DECODE_FAILED');
  }

  const decodedPayload: Prisma.InputJsonValue = { ...report.decoded.raw, mileageAtAnalysis: input.mileage };

  const analysis = await db.vinAnalysis.create({
    data: {
      vehicleId: vehicle.id,
      decodedPayload,
      manualCorrections: input.manualMake || input.manualModel || input.manualYear
        ? { make: input.manualMake, model: input.manualModel, year: input.manualYear }
        : undefined,
      marketValue: report.valuation.value.value.marketValue,
      wholesaleValue: report.valuation.value.value.wholesaleValue,
      retailValue: report.valuation.value.value.retailValue,
      transportEstimate: input.transportCost ?? 0,
      repairEstimate: report.damage.value.totalCost,
      feesEstimate: input.auctionFees ?? 0,
      taxesEstimate: input.taxesCost ?? 0,
      projectedRoi: report.profitability.value.projectedRoi,
      confidenceScore: report.confidenceScore,
      riskSummary: report.risk.value.signals.join('; '),
      aiExplanation: report.explanation.join('; '),
      recommendation: report.recommendation
    }
  });

  await db.vehicle.updateMany({
    where: { id: vehicle.id, organizationId },
    data: {
      status: 'ANALYZED',
      mileage: input.mileage,
      make: vehicle.make ?? report.decoded.make ?? undefined,
      model: vehicle.model ?? report.decoded.model ?? undefined,
      year: vehicle.year ?? report.decoded.modelYear ?? undefined
    }
  });

  await writeAuditLog({
    organizationId,
    actorUserId,
    action: 'vin_intelligence_analyze',
    entityType: 'vin_analysis',
    entityId: analysis.id,
    afterState: { recommendation: report.recommendation, riskLevel: report.risk.value.level, confidenceScore: report.confidenceScore }
  });
  await writeActivityLog({
    organizationId,
    actorUserId,
    entityType: 'vin_analysis',
    entityId: analysis.id,
    type: 'vin_analysis.ai_analyzed',
    summary: `AI VIN intelligence analysis completed for ${vehicle.vin} (${report.recommendation}, risk ${report.risk.value.level})`,
    payload: { recallCount: report.recalls.length, desirability: report.desirability.value, healthScore: report.health.value.score }
  });

  return { analysis, report };
}
