import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createListingSchema, updateListingSchema } from '@/lib/validators/inventory';
import { AppError } from '@/lib/api/responses';

export async function listListingsForOrg(organizationId: string, vehicleId?: string) {
  return db.listing.findMany({ where: { organizationId, ...(vehicleId ? { vehicleId } : {}) }, orderBy: { createdAt: 'desc' } });
}

export async function createListingForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createListingSchema.parse(payload);
  const vehicle = await db.vehicle.findFirst({ where: { id: input.vehicleId, organizationId } });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  const listing = await db.listing.create({ data: { ...input, organizationId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'listing', entityId: listing.id, afterState: listing });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'listing', entityId: listing.id, type: 'listing.created', summary: `Listing created for ${vehicle.vin} on ${input.channel}`, payload: listing });
  return listing;
}

export async function updateListingForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = updateListingSchema.parse(payload);
  const existing = await db.listing.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Listing not found', 404, 'NOT_FOUND');

  const data = { ...input, ...(input.status === 'PUBLISHED' && !existing.publishedAt ? { publishedAt: new Date() } : {}) };
  const { count } = await db.listing.updateMany({ where: { id, organizationId }, data });
  if (count === 0) throw new AppError('Listing not found', 404, 'NOT_FOUND');
  const listing = await db.listing.findFirstOrThrow({ where: { id, organizationId } });

  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'listing', entityId: id, beforeState: existing, afterState: listing });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'listing', entityId: id, type: 'listing.updated', summary: `Listing ${listing.channel} status: ${listing.status}`, payload: listing });
  return listing;
}
