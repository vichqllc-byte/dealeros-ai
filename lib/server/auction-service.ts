import { db } from '@/lib/db/client';
import { auctionSearchSchema } from '@/lib/validators/listing';
import { searchCopartListings } from '@/lib/integrations/copart-client';
import { searchIaaListings } from '@/lib/integrations/iaa-client';
import { searchManheimListings } from '@/lib/integrations/manheim-client';

export async function searchCopartForOrg(organizationId: string, input: unknown) {
  const filters = auctionSearchSchema.parse(input);
  const items = await searchCopartListings(filters);

  await Promise.all(items.map((item) => db.auctionListing.upsert({
    where: { source_lotNumber: { source: 'COPART', lotNumber: item.lotNumber } },
    update: {
      vin: item.vin,
      year: item.year,
      make: item.make,
      model: item.model,
      title: item.title,
      currentBid: item.currentBid,
      buyNowPrice: item.buyNowPrice,
      saleDate: item.saleDate ? new Date(item.saleDate) : null,
      rawPayload: item,
      organizationId
    },
    create: {
      organizationId,
      source: 'COPART',
      lotNumber: item.lotNumber,
      vin: item.vin,
      year: item.year,
      make: item.make,
      model: item.model,
      title: item.title,
      currentBid: item.currentBid,
      buyNowPrice: item.buyNowPrice,
      saleDate: item.saleDate ? new Date(item.saleDate) : null,
      rawPayload: item
    }
  })));

  return items;
}

export async function searchIaaForOrg(organizationId: string, input: unknown) {
  const filters = auctionSearchSchema.parse(input);
  const items = await searchIaaListings(filters);

  await Promise.all(items.map((item) => db.auctionListing.upsert({
    where: { source_lotNumber: { source: 'IAA', lotNumber: item.lotNumber } },
    update: {
      vin: item.vin,
      year: item.year,
      make: item.make,
      model: item.model,
      title: item.title,
      currentBid: item.currentBid,
      buyNowPrice: item.buyNowPrice,
      saleDate: item.saleDate ? new Date(item.saleDate) : null,
      rawPayload: item,
      organizationId
    },
    create: {
      organizationId,
      source: 'IAA',
      lotNumber: item.lotNumber,
      vin: item.vin,
      year: item.year,
      make: item.make,
      model: item.model,
      title: item.title,
      currentBid: item.currentBid,
      buyNowPrice: item.buyNowPrice,
      saleDate: item.saleDate ? new Date(item.saleDate) : null,
      rawPayload: item
    }
  })));

  return items;
}

export async function searchManheimForOrg(organizationId: string, input: unknown) {
  const filters = auctionSearchSchema.parse(input);
  const items = await searchManheimListings(filters);

  await Promise.all(items.map((item) => db.auctionListing.upsert({
    where: { source_lotNumber: { source: 'MANHEIM', lotNumber: item.lotNumber } },
    update: {
      vin: item.vin,
      year: item.year,
      make: item.make,
      model: item.model,
      title: item.title,
      currentBid: item.currentBid,
      buyNowPrice: item.buyNowPrice,
      saleDate: item.saleDate ? new Date(item.saleDate) : null,
      rawPayload: item,
      organizationId
    },
    create: {
      organizationId,
      source: 'MANHEIM',
      lotNumber: item.lotNumber,
      vin: item.vin,
      year: item.year,
      make: item.make,
      model: item.model,
      title: item.title,
      currentBid: item.currentBid,
      buyNowPrice: item.buyNowPrice,
      saleDate: item.saleDate ? new Date(item.saleDate) : null,
      rawPayload: item
    }
  })));

  return items;
}
