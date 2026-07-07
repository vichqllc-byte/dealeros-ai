import { ListingChannel, ListingStatus } from '@prisma/client';
import { db } from '@/lib/db/client';
import { createListingPostSchema } from '@/lib/validators/listing';
import { publishMarketplaceListing } from '@/lib/integrations/marketplace-client';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { AppError } from '@/lib/api/responses';
import { createNotificationForOrg } from '@/lib/server/notification-service';

export async function createAndPublishListing(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createListingPostSchema.parse(payload);
  const vehicle = await db.vehicle.findFirst({ where: { id: input.vehicleId, organizationId } });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  const providerResult = await publishMarketplaceListing(input.channel as ListingChannel, {
    title: input.title,
    description: input.description,
    price: input.price,
    vin: vehicle.vin
  });

  const status: ListingStatus = providerResult.status === 'POSTED' ? 'POSTED' : 'FAILED';

  const listing = await db.listingPost.create({
    data: {
      organizationId,
      vehicleId: input.vehicleId,
      channel: input.channel,
      title: input.title,
      description: input.description,
      price: input.price,
      status,
      externalId: providerResult.externalId || null,
      errorMessage: providerResult.errorMessage,
      postedAt: status === 'POSTED' ? new Date() : null
    }
  });

  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'listing_post', entityId: listing.id, afterState: listing });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'listing_post', entityId: listing.id, type: 'listing.posted', summary: `Listing posted to ${listing.channel}`, payload: listing });
  await createNotificationForOrg(organizationId, actorUserId, {
    channel: 'IN_APP',
    title: status === 'POSTED' ? 'Marketplace listing posted' : 'Marketplace listing failed',
    message: status === 'POSTED'
      ? `Listing ${listing.id} posted to ${listing.channel}.`
      : `Listing ${listing.id} failed for ${listing.channel}: ${listing.errorMessage ?? 'Unknown error'}`,
    metadata: { listingId: listing.id, channel: listing.channel, status: listing.status }
  });

  return listing;
}

export async function listListingsForOrg(organizationId: string) {
  return db.listingPost.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, include: { vehicle: true } });
}
