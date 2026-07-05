import { z } from 'zod';

export const createVinAnalysisSchema = z.object({
  vehicleId: z.string().min(1),
  decodedPayload: z.record(z.any()),
  manualCorrections: z.record(z.any()).optional(),
  marketValue: z.number().optional(),
  wholesaleValue: z.number().optional(),
  retailValue: z.number().optional(),
  transportEstimate: z.number().optional(),
  repairEstimate: z.number().optional(),
  feesEstimate: z.number().optional(),
  taxesEstimate: z.number().optional(),
  projectedRoi: z.number().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  riskSummary: z.string().optional(),
  aiExplanation: z.string().optional(),
  recommendation: z.enum(['BUY', 'NEGOTIATE', 'WAIT', 'PASS']).optional(),
  workflowState: z.enum(['NEW', 'REVIEWED', 'QUALIFIED', 'OFFERED', 'PURCHASED', 'SOLD', 'PASSED']).optional()
});
