import type { Explained, Recall, RepairEstimate, RiskAssessment } from '@/lib/vin-intelligence/types';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type VehicleHealth = {
  score: number;
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor';
};

/** Composite health score (0-100) from open recalls, risk signals, and
 * repair severity - all real inputs computed elsewhere in this engine. */
export class VehicleHealthService {
  score(input: { recalls: Recall[]; risk: RiskAssessment; repairEstimate: RepairEstimate; decodeCompletenessPercent: number }): Explained<VehicleHealth> {
    let score = 90;
    const reasons: string[] = [];

    const recallPenalty = Math.min(30, input.recalls.length * 8);
    if (recallPenalty > 0) {
      score -= recallPenalty;
      reasons.push(`${input.recalls.length} open recall(s) reduce health score`);
    }

    score -= input.risk.score * 0.3;
    if (input.risk.score > 0) reasons.push(`Risk assessment score of ${input.risk.score} applied as a health penalty`);

    if (input.repairEstimate.totalCost > 3000) {
      score -= 15;
      reasons.push(`High estimated repair cost (${input.repairEstimate.totalCost.toLocaleString()}) reduces health score`);
    } else if (input.repairEstimate.totalCost > 1200) {
      score -= 7;
      reasons.push(`Moderate estimated repair cost (${input.repairEstimate.totalCost.toLocaleString()}) reduces health score`);
    }

    if (input.decodeCompletenessPercent < 40) {
      score -= 5;
      reasons.push('Low VIN decode completeness limits confidence in this score');
    }

    const finalScore = clamp(Math.round(score), 0, 100);
    const label: VehicleHealth['label'] = finalScore >= 85 ? 'Excellent' : finalScore >= 65 ? 'Good' : finalScore >= 40 ? 'Fair' : 'Poor';

    if (reasons.length === 0) reasons.push('No health-reducing signals found');

    return { value: { score: finalScore, label }, reasons };
  }
}

export const vehicleHealthService = new VehicleHealthService();
