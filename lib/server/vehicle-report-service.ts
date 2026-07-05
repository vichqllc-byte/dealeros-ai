import { db } from '@/lib/db/client';
import { AppError } from '@/lib/api/responses';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { getVehicleHistoryReport } from '@/lib/server/vehicle-history-service';
import { fullIntelligenceOrchestrator, type FullIntelligenceOrchestrator } from '@/lib/vin-intelligence/full-intelligence-orchestrator';
import { generateVehicleReportPdf } from '@/lib/vin-intelligence/reporting/pdf-report-service';
import { createLogger } from '@/lib/logging/logger';

const logger = createLogger('vehicle-report-service');

/**
 * Generates the full professional PDF vehicle intelligence report for an
 * org-owned vehicle: real VIN decode + recalls + risk + market values +
 * AI recommendations (Phases 4-5), combined with the real vehicle history
 * pipeline, rendered into a PDF. Writes the same audit/activity trail
 * established in Phases 2-3.
 */
export async function generateVehicleIntelligenceReport(
  organizationId: string,
  actorUserId: string,
  vehicleId: string,
  orchestrator: FullIntelligenceOrchestrator = fullIntelligenceOrchestrator
) {
  const vehicle = await db.vehicle.findFirst({ where: { id: vehicleId, organizationId } });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
  if (vehicle.mileage == null) throw new AppError('Vehicle mileage is required before generating a report', 422, 'VALIDATION_ERROR');

  const history = await getVehicleHistoryReport(organizationId, vehicleId);

  let report;
  try {
    report = await orchestrator.analyze({
      vin: vehicle.vin,
      mileageMiles: vehicle.mileage,
      manualMake: vehicle.make,
      manualModel: vehicle.model,
      manualYear: vehicle.year
    });
  } catch (error) {
    logger.error('Failed to generate vehicle intelligence report', { vehicleId, error: error instanceof Error ? error.message : String(error) });
    throw new AppError(error instanceof Error ? error.message : 'Report generation failed', 502, 'REPORT_GENERATION_FAILED');
  }

  const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vin;
  const pdfBytes = await generateVehicleReportPdf({
    vin: vehicle.vin,
    vehicleLabel,
    mileage: vehicle.mileage,
    report,
    history
  });

  await writeAuditLog({
    organizationId,
    actorUserId,
    action: 'vehicle_report_generate',
    entityType: 'vehicle',
    entityId: vehicle.id,
    afterState: { recommendation: report.recommendation, riskLevel: report.risk.value.level }
  });
  await writeActivityLog({
    organizationId,
    actorUserId,
    entityType: 'vehicle',
    entityId: vehicle.id,
    type: 'vehicle.report_generated',
    summary: `Vehicle intelligence report generated for ${vehicle.vin}`
  });

  return { pdfBytes, report, history, vehicleLabel };
}
