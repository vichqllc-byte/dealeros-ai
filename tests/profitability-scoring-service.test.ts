import { describe, expect, it } from 'vitest';
import { ProfitabilityScoringService } from '@/lib/vin-intelligence/services/profitability-scoring-service';
import type { RiskAssessment, ValuationEstimate } from '@/lib/vin-intelligence/types';

const valuation: ValuationEstimate = { retailValue: 20000, wholesaleValue: 16400, marketValue: 18200 };
const lowRisk: RiskAssessment = { level: 'Low', score: 0, signals: [] };
const highRisk: RiskAssessment = { level: 'High', score: 70, signals: ['signal'] };

describe('ProfitabilityScoringService', () => {
  it('recommends BUY for a strong ROI', () => {
    const service = new ProfitabilityScoringService();
    const result = service.score({
      valuation, acquisitionCost: 12000, repairCost: 500, reconditioningCost: 300,
      transportCost: 200, feesCost: 200, taxesCost: 0, risk: lowRisk
    });
    expect(result.value.recommendation).toBe('BUY');
    expect(result.value.projectedRoi).toBeGreaterThan(0.18);
  });

  it('recommends PASS for negative ROI', () => {
    const service = new ProfitabilityScoringService();
    const result = service.score({
      valuation, acquisitionCost: 22000, repairCost: 3000, reconditioningCost: 1000,
      transportCost: 500, feesCost: 500, taxesCost: 0, risk: lowRisk
    });
    expect(result.value.recommendation).toBe('PASS');
  });

  it('overrides to PASS on high risk even with a strong ROI', () => {
    const service = new ProfitabilityScoringService();
    const result = service.score({
      valuation, acquisitionCost: 12000, repairCost: 500, reconditioningCost: 300,
      transportCost: 200, feesCost: 200, taxesCost: 0, risk: highRisk
    });
    expect(result.value.recommendation).toBe('PASS');
    expect(result.reasons.some((r) => r.includes('overrides profit projection'))).toBe(true);
  });
});
