import type { Explained } from '@/lib/vin-intelligence/types';

/** Annualizes the projected deal ROI over the estimated holding period
 * (time-to-sell), so a thin-margin quick-flip and a fat-margin slow-mover
 * can be compared on the same basis. */
export class DealerRoiService {
  score(input: { projectedRoi: number; estimatedHoldingDays: number }): Explained<number> {
    const holdingDays = Math.max(1, input.estimatedHoldingDays);
    const annualizedRoi = Number((input.projectedRoi * (365 / holdingDays)).toFixed(3));

    return {
      value: annualizedRoi,
      reasons: [`Projected ROI of ${(input.projectedRoi * 100).toFixed(1)}% annualized over an estimated ${holdingDays}-day holding period`]
    };
  }
}

export const dealerRoiService = new DealerRoiService();
