import type { Explained, RiskAssessment, ValuationEstimate } from '@/lib/vin-intelligence/types';

export type RecommendationKey = 'BUY' | 'NEGOTIATE' | 'WAIT' | 'PASS';

export type ProfitabilitySummary = {
  projectedRoi: number;
  recommendation: RecommendationKey;
};

/** Real profit math from valuation + real cost inputs, gated by the risk
 * assessment (a high-risk vehicle is never recommended as a confident BUY
 * regardless of projected margin). */
export class ProfitabilityScoringService {
  score(input: {
    valuation: ValuationEstimate;
    acquisitionCost: number;
    repairCost: number;
    reconditioningCost: number;
    transportCost: number;
    feesCost: number;
    taxesCost: number;
    risk: RiskAssessment;
  }): Explained<ProfitabilitySummary> {
    const totalCost = input.acquisitionCost + input.repairCost + input.reconditioningCost + input.transportCost + input.feesCost + input.taxesCost;
    const projectedProfit = input.valuation.retailValue - totalCost;
    const projectedRoi = totalCost > 0 ? Number((projectedProfit / totalCost).toFixed(3)) : 0;

    const reasons = [
      `Projected profit of ${Math.round(projectedProfit).toLocaleString()} against total cost of ${Math.round(totalCost).toLocaleString()} (ROI ${(projectedRoi * 100).toFixed(1)}%)`
    ];

    let recommendation: RecommendationKey;
    if (input.risk.level === 'High') {
      recommendation = 'PASS';
      reasons.push('High risk assessment overrides profit projection - recommend passing');
    } else if (projectedRoi >= 0.18) {
      recommendation = 'BUY';
      reasons.push('ROI clears the confident-buy threshold (18%+)');
    } else if (projectedRoi >= 0.08) {
      recommendation = 'NEGOTIATE';
      reasons.push('ROI is positive but below the confident-buy threshold - negotiate acquisition cost down');
    } else if (projectedRoi >= 0) {
      recommendation = 'WAIT';
      reasons.push('ROI is marginal - wait for a better acquisition price or market shift');
    } else {
      recommendation = 'PASS';
      reasons.push('Projected ROI is negative');
    }

    return { value: { projectedRoi, recommendation }, reasons };
  }
}

export const profitabilityScoringService = new ProfitabilityScoringService();
