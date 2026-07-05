import type { Explained } from '@/lib/vin-intelligence/types';

export type DepreciationForecastPoint = { monthsFromNow: number; projectedValue: number };

// Documented average monthly depreciation rate for a used vehicle absent a
// live pricing-history feed (roughly 1.3%/month, i.e. ~15%/year, a widely
// cited industry rule of thumb for post-new-car depreciation curves).
const MONTHLY_DEPRECIATION_RATE = 0.013;

/** Projects future value from today's real/estimated market value using a
 * documented monthly depreciation rate - not sourced from a live
 * residual-value feed. */
export class DepreciationForecastService {
  forecast(currentValue: number, horizonsMonths: number[] = [6, 12, 24]): Explained<DepreciationForecastPoint[]> {
    const points = horizonsMonths.map((monthsFromNow) => ({
      monthsFromNow,
      projectedValue: Math.round(currentValue * Math.pow(1 - MONTHLY_DEPRECIATION_RATE, monthsFromNow))
    }));

    return {
      value: points,
      reasons: [`Projected using a documented ${(MONTHLY_DEPRECIATION_RATE * 100).toFixed(1)}%/month depreciation rate (no live residual-value feed configured)`]
    };
  }
}

export const depreciationForecastService = new DepreciationForecastService();
