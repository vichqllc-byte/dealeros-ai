import { z } from 'zod';

export const createListingPostSchema = z.object({
  vehicleId: z.string().min(1),
  channel: z.enum(['FACEBOOK_MARKETPLACE', 'CRAIGSLIST', 'OFFERUP']),
  title: z.string().min(3).max(180),
  description: z.string().min(10).max(6000),
  price: z.number().nonnegative().optional()
});

export const auctionSearchSchema = z.object({
  query: z.string().min(1).max(120).optional(),
  vin: z.string().length(17).optional(),
  source: z.enum(['COPART', 'IAA', 'MANHEIM']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
});
