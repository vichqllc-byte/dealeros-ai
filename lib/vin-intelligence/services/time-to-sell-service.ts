import type { Explained } from '@/lib/vin-intelligence/types';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Documented estimate (no dealer sales-velocity/DMS feed is configured):
 * baseline 45 days on lot, adjusted by desirability score and how the
 * asking price compares to the estimated market value. */
export class TimeToSellService {
  predict(input: { desirabilityScore: number; askingPrice: number; marketValue: number }): Explained<number> {
    let days = 45;
    const reasons: string[] = ['Baseline of 45 days on lot for this vehicle segment'];

    const desirabilityAdjustment = Math.round((50 - input.desirabilityScore) * 0.4);
    days += desirabilityAdjustment;
    if (desirabilityAdjustment !== 0) {
      reasons.push(`Desirability score of ${input.desirabilityScore} adjusted the estimate by ${desirabilityAdjustment >= 0 ? '+' : ''}${desirabilityAdjustment} days`);
    }

    if (input.marketValue > 0) {
      const priceRatio = input.askingPrice / input.marketValue;
      if (priceRatio > 1.05) {
        const penalty = Math.round((priceRatio - 1) * 120);
        days += penalty;
        reasons.push(`Asking price is ${Math.round((priceRatio - 1) * 100)}% above estimated market value, adding ${penalty} days`);
      } else if (priceRatio < 0.95) {
        const bonus = Math.round((1 - priceRatio) * 90);
        days -= bonus;
        reasons.push(`Asking price is ${Math.round((1 - priceRatio) * 100)}% below estimated market value, reducing the estimate by ${bonus} days`);
      }
    }

    return { value: clamp(Math.round(days), 5, 180), reasons };
  }
}

export const timeToSellService = new TimeToSellService();
