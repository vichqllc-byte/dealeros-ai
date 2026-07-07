import { z } from 'zod';

const vinSchema = z.string().trim().toUpperCase().length(17);
const listingUrlSchema = z.string().trim().url();

const vehicleSchemaBase = z.object({
  vin: vinSchema.optional(),
  listingUrl: listingUrlSchema.optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  trim: z.string().optional(),
  mileage: z.number().int().nonnegative().optional(),
  workflowState: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'OFFERED', 'PURCHASED', 'SOLD', 'PASSED']).optional()
});

export const createVehicleSchema = vehicleSchemaBase.superRefine((input, context) => {
  if (!input.vin && !input.listingUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['listingUrl'],
      message: 'Listing URL or VIN is required'
    });
  }
});

export const updateVehicleSchema = vehicleSchemaBase.partial();
