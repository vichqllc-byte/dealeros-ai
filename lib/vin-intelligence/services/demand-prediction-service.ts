import type { DecodedVehicle, Explained } from '@/lib/vin-intelligence/types';

export type DemandLevel = 'Low' | 'Medium' | 'High';

const HIGH_DEMAND_BODY_CLASS = /truck|pickup|suv|utility/i;
const LOW_DEMAND_BODY_CLASS = /wagon|minivan/i;

/** Documented estimate from real decoded body class and the desirability
 * score (no regional sales/DMS demand feed is configured). */
export class DemandPredictionService {
  predict(input: { decoded: DecodedVehicle; desirabilityScore: number }): Explained<DemandLevel> {
    let score = input.desirabilityScore;
    const reasons: string[] = [`Baseline demand derived from desirability score (${input.desirabilityScore}/100)`];

    if (input.decoded.bodyClass && HIGH_DEMAND_BODY_CLASS.test(input.decoded.bodyClass)) {
      score += 15;
      reasons.push(`Body class "${input.decoded.bodyClass}" is a historically high-demand segment`);
    } else if (input.decoded.bodyClass && LOW_DEMAND_BODY_CLASS.test(input.decoded.bodyClass)) {
      score -= 10;
      reasons.push(`Body class "${input.decoded.bodyClass}" is a historically lower-demand segment`);
    }

    const level: DemandLevel = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
    return { value: level, reasons };
  }
}

export const demandPredictionService = new DemandPredictionService();
