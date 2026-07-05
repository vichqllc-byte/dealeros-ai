import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createTradeInSchema } from '@/lib/validators/sales';
import { AppError } from '@/lib/api/responses';
import { vinDecoderService } from '@/lib/vin-intelligence/services/vin-decoder-service';
import { marketIntelligenceService } from '@/lib/vin-intelligence/providers/market-value/market-intelligence-service';

export async function listTradeInsForSale(organizationId: string, saleId: string) {
  const sale = await db.sale.findFirst({ where: { id: saleId, organizationId } });
  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  return db.tradeInVehicle.findMany({ where: { saleId }, orderBy: { createdAt: 'desc' } });
}

/** Real VIN-based appraisal: when a trade-in VIN is provided and no
 * manual appraisedValue is given, decodes the VIN and uses the same real
 * market-intelligence engine (Phase 4/5) to compute a wholesale-value
 * appraisal - the same honest real/estimated distinction as everywhere
 * else in this codebase. */
export async function createTradeInForSale(organizationId: string, actorUserId: string, saleId: string, payload: unknown) {
  const input = createTradeInSchema.parse(payload);
  const sale = await db.sale.findFirst({ where: { id: saleId, organizationId } });
  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');

  let appraisedValue = input.appraisedValue;
  let appraisalNote = 'Manually entered appraisal';

  if (appraisedValue == null && input.vin && input.mileage != null) {
    const decoded = await vinDecoderService.decode(input.vin);
    const marketValues = await marketIntelligenceService.getMarketValues(decoded, input.mileage);
    appraisedValue = marketValues.values.wholesale;
    appraisalNote = `Auto-appraised from decoded VIN wholesale value (${marketValues.quality})`;
  }

  if (appraisedValue == null) {
    throw new AppError('appraisedValue is required unless both vin and mileage are provided for automatic appraisal', 422, 'VALIDATION_ERROR');
  }

  const tradeIn = await db.tradeInVehicle.create({ data: { ...input, saleId, appraisedValue } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'trade_in', entityId: tradeIn.id, afterState: tradeIn });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'trade_in', entityId: tradeIn.id, type: 'trade_in.created', summary: `Trade-in appraised at $${Number(appraisedValue).toLocaleString()} (${appraisalNote})`, payload: tradeIn });
  return tradeIn;
}
