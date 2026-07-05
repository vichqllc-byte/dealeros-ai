import type { DecodedVehicle, Explained, Recall, RiskAssessment } from '@/lib/vin-intelligence/types';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Weighted desirability score (0-100) built entirely from real signals:
 * open recall count (NHTSA), decoded safety equipment count (NHTSA),
 * mileage relative to vehicle age, decode completeness, and the risk
 * assessment. No fabricated inputs. */
export class DesirabilityScoringService {
  score(input: {
    decoded: DecodedVehicle;
    mileageMiles: number;
    recalls: Recall[];
    risk: RiskAssessment;
  }): Explained<number> {
    let score = 50;
    const reasons: string[] = [];

    const age = input.decoded.modelYear ? new Date().getFullYear() - input.decoded.modelYear : null;
    if (age != null) {
      const expectedMileage = age * 12000;
      if (input.mileageMiles < expectedMileage * 0.8) {
        score += 12;
        reasons.push('Mileage is well below what is expected for this vehicle\'s age');
      } else if (input.mileageMiles > expectedMileage * 1.3) {
        score -= 12;
        reasons.push('Mileage is well above what is expected for this vehicle\'s age');
      }
    }

    const safetyCount = input.decoded.safetyEquipment.length;
    if (safetyCount >= 8) {
      score += 10;
      reasons.push(`Strong decoded safety equipment set (${safetyCount} features)`);
    } else if (safetyCount <= 2) {
      score -= 5;
      reasons.push(`Minimal decoded safety equipment (${safetyCount} features)`);
    }

    if (input.recalls.length > 0) {
      const penalty = Math.min(20, input.recalls.length * 7);
      score -= penalty;
      reasons.push(`${input.recalls.length} open recall(s) reduce desirability`);
    } else {
      score += 5;
      reasons.push('No open recalls found');
    }

    if (input.risk.level === 'High') {
      score -= 25;
      reasons.push('High risk assessment significantly reduces desirability');
    } else if (input.risk.level === 'Medium') {
      score -= 10;
      reasons.push('Medium risk assessment moderately reduces desirability');
    }

    if (input.decoded.decodeCompletenessPercent < 40) {
      score -= 8;
      reasons.push('Low VIN decode completeness reduces confidence in this score');
    }

    return { value: clamp(Math.round(score), 0, 100), reasons };
  }
}

export const desirabilityScoringService = new DesirabilityScoringService();
