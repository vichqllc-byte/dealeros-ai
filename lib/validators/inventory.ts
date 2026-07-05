import { z } from 'zod';

export const transitionStageSchema = z.object({
  toStage: z.enum(['ACQUISITION', 'PURCHASE', 'INSPECTION', 'RECONDITIONING', 'PRICING', 'PUBLISHING', 'SOLD'])
});

export const createInspectionReportSchema = z.object({
  vehicleId: z.string().min(1),
  overallCondition: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']),
  findings: z.record(z.any())
});

export const createPriceRecordSchema = z.object({
  vehicleId: z.string().min(1),
  price: z.number().positive(),
  reason: z.string().max(500).optional()
});

export const createListingSchema = z.object({
  vehicleId: z.string().min(1),
  channel: z.string().min(1).max(100),
  status: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED']).optional(),
  url: z.string().url().optional()
});

export const updateListingSchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED']).optional(),
  url: z.string().url().optional()
});
