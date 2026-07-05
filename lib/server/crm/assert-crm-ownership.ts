import { db } from '@/lib/db/client';
import { AppError } from '@/lib/api/responses';

/** Shared by Task/Note/CommunicationLogEntry/Appointment: both leadId and
 * customerId are optional foreign keys, but whichever is provided must
 * belong to the caller's organization. */
export async function assertLeadAndCustomerOwnership(organizationId: string, input: { leadId?: string; customerId?: string }) {
  if (input.leadId) {
    const lead = await db.lead.findFirst({ where: { id: input.leadId, organizationId } });
    if (!lead) throw new AppError('Lead not found', 404, 'NOT_FOUND');
  }
  if (input.customerId) {
    const customer = await db.customer.findFirst({ where: { id: input.customerId, organizationId } });
    if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');
  }
}
