import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createSaleDocumentSchema, recordManualSignatureSchema } from '@/lib/validators/sales';
import { AppError } from '@/lib/api/responses';
import { generateSaleDocumentPdf } from '@/lib/sales/sale-document-pdf';
import { buildDeliveryChecklist } from '@/lib/sales/delivery-checklist';
import { calculateLoanPayment } from '@/lib/sales/payment-calculator';

async function loadSaleWithRelations(organizationId: string, saleId: string) {
  const sale = await db.sale.findFirst({
    where: { id: saleId, organizationId },
    include: { vehicle: true, customer: true, tradeIns: true, financingApplications: true }
  });
  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  return sale;
}

export async function listSaleDocuments(organizationId: string, saleId: string) {
  const sale = await db.sale.findFirst({ where: { id: saleId, organizationId } });
  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  return db.saleDocument.findMany({ where: { saleId }, orderBy: { createdAt: 'desc' } });
}

export async function createSaleDocumentForSale(organizationId: string, actorUserId: string, saleId: string, payload: unknown) {
  const input = createSaleDocumentSchema.parse(payload);
  const sale = await db.sale.findFirst({ where: { id: saleId, organizationId } });
  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');

  const document = await db.saleDocument.create({ data: { saleId, type: input.type } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'sale_document', entityId: document.id, afterState: document });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'sale_document', entityId: document.id, type: 'sale_document.created', summary: `${input.type} generated for sale`, payload: document });
  return document;
}

/** Records that a physical/in-person (wet) signature was collected - the
 * honest fallback when no licensed e-sign provider is configured (see
 * lib/sales/signature-provider.ts). Not presented as a verified
 * electronic signature. */
export async function recordManualSignatureForDocument(organizationId: string, actorUserId: string, saleId: string, documentId: string, payload: unknown) {
  const input = recordManualSignatureSchema.parse(payload);
  const sale = await db.sale.findFirst({ where: { id: saleId, organizationId } });
  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  const existing = await db.saleDocument.findFirst({ where: { id: documentId, saleId } });
  if (!existing) throw new AppError('Sale document not found', 404, 'NOT_FOUND');

  const { count } = await db.saleDocument.updateMany({
    where: { id: documentId, saleId },
    data: { signatureStatus: 'SIGNED', signatureMethod: 'MANUAL_WET_SIGNATURE', signedByName: input.signedByName, signedAt: new Date() }
  });
  if (count === 0) throw new AppError('Sale document not found', 404, 'NOT_FOUND');
  const document = await db.saleDocument.findFirstOrThrow({ where: { id: documentId, saleId } });

  await writeAuditLog({ organizationId, actorUserId, action: 'sign', entityType: 'sale_document', entityId: documentId, beforeState: existing, afterState: document });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'sale_document', entityId: documentId, type: 'sale_document.signed', summary: `${existing.type} manually signed by ${input.signedByName}`, payload: document });
  return document;
}

export async function generateSaleDocumentPdfBytes(organizationId: string, saleId: string, documentId: string): Promise<{ pdfBytes: Uint8Array; document: { type: string } }> {
  const sale = await loadSaleWithRelations(organizationId, saleId);
  const document = await db.saleDocument.findFirst({ where: { id: documentId, saleId } });
  if (!document) throw new AppError('Sale document not found', 404, 'NOT_FOUND');

  const vehicleLabel = [sale.vehicle.year, sale.vehicle.make, sale.vehicle.model].filter(Boolean).join(' ') || sale.vehicle.vin;
  const checklist = buildDeliveryChecklist(sale.deliveryChecklist as Array<{ id: string; label: string; completed: boolean }> | null);

  const pdfBytes = await generateSaleDocumentPdf({
    documentType: document.type,
    vehicleLabel,
    vin: sale.vehicle.vin,
    customerName: `${sale.customer.firstName} ${sale.customer.lastName}`,
    salePrice: Number(sale.salePrice),
    saleDate: sale.saleDate,
    tradeIns: sale.tradeIns.map((t) => ({ vin: t.vin, appraisedValue: Number(t.appraisedValue) })),
    financing: sale.financingApplications.map((f) => ({
      lenderName: f.lenderName,
      principal: Number(f.principal),
      apr: f.apr,
      termMonths: f.termMonths,
      monthlyPayment: calculateLoanPayment({ principal: Number(f.principal), apr: f.apr, termMonths: f.termMonths }).monthlyPayment
    })),
    deliveryChecklist: checklist,
    signatureStatus: document.signatureStatus,
    signedByName: document.signedByName,
    signatureMethod: document.signatureMethod
  });

  return { pdfBytes, document };
}
