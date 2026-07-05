import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createFinancingApplicationSchema } from '@/lib/validators/sales';
import { AppError } from '@/lib/api/responses';
import { calculateLoanPayment } from '@/lib/sales/payment-calculator';

function withPayment<T extends { principal: unknown; apr: number; termMonths: number }>(record: T) {
  const payment = calculateLoanPayment({ principal: Number(record.principal), apr: record.apr, termMonths: record.termMonths });
  return { ...record, payment };
}

export async function listFinancingApplicationsForSale(organizationId: string, saleId: string) {
  const sale = await db.sale.findFirst({ where: { id: saleId, organizationId } });
  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  const applications = await db.financingApplication.findMany({ where: { saleId }, orderBy: { createdAt: 'desc' } });
  return applications.map(withPayment);
}

export async function createFinancingApplicationForSale(organizationId: string, actorUserId: string, saleId: string, payload: unknown) {
  const input = createFinancingApplicationSchema.parse(payload);
  const sale = await db.sale.findFirst({ where: { id: saleId, organizationId } });
  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');

  const application = await db.financingApplication.create({ data: { ...input, saleId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'financing_application', entityId: application.id, afterState: application });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'financing_application', entityId: application.id, type: 'financing.submitted', summary: `Financing application submitted: $${Number(input.principal).toLocaleString()} @ ${input.apr}% for ${input.termMonths}mo`, payload: application });
  return withPayment(application);
}

export async function updateFinancingApplicationStatus(organizationId: string, actorUserId: string, saleId: string, id: string, status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN') {
  const sale = await db.sale.findFirst({ where: { id: saleId, organizationId } });
  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  const existing = await db.financingApplication.findFirst({ where: { id, saleId } });
  if (!existing) throw new AppError('Financing application not found', 404, 'NOT_FOUND');

  const { count } = await db.financingApplication.updateMany({ where: { id, saleId }, data: { status } });
  if (count === 0) throw new AppError('Financing application not found', 404, 'NOT_FOUND');
  const application = await db.financingApplication.findFirstOrThrow({ where: { id, saleId } });

  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'financing_application', entityId: id, beforeState: existing, afterState: application });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'financing_application', entityId: id, type: 'financing.status_changed', summary: `Financing application status: ${status}`, payload: application });
  return withPayment(application);
}
