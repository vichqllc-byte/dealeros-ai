import { z } from 'zod';

export const createSaleSchema = z.object({
  vehicleId: z.string().min(1),
  customerId: z.string().min(1),
  salePrice: z.number().positive(),
  saleDate: z.coerce.date().optional()
});

export const updateSaleSchema = z.object({
  salePrice: z.number().positive().optional(),
  saleDate: z.coerce.date().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional()
});

export const createTradeInSchema = z.object({
  vin: z.string().length(17).optional(),
  year: z.number().int().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  mileage: z.number().int().nonnegative().optional(),
  appraisedValue: z.number().nonnegative().optional(),
  payoffAmount: z.number().nonnegative().optional()
});

export const createFinancingApplicationSchema = z.object({
  lenderName: z.string().max(200).optional(),
  principal: z.number().positive(),
  apr: z.number().min(0).max(50),
  termMonths: z.number().int().positive(),
  status: z.enum(['PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN']).optional()
});

export const createSaleDocumentSchema = z.object({
  type: z.enum(['PURCHASE_AGREEMENT', 'BUYER_DISCLOSURE', 'DELIVERY_CHECKLIST', 'OTHER'])
});

export const recordManualSignatureSchema = z.object({
  signedByName: z.string().min(1).max(200)
});

export const updateDeliveryChecklistSchema = z.object({
  itemId: z.string().min(1),
  completed: z.boolean()
});
