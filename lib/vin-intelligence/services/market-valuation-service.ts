import type { DecodedVehicle, Explained, Sourced, ValuationEstimate } from '@/lib/vin-intelligence/types';

/**
 * Pluggable valuation provider boundary. No paid pricing-data provider
 * (KBB, Black Book, MMR, etc.) is configured in this environment, so
 * `HeuristicValuationProvider` is the default: a documented, deterministic
 * depreciation-curve estimate computed from real decoded VIN attributes
 * (age, body class, horsepower) and real mileage - not a live market feed.
 * Every result is tagged `quality: 'estimated'` so callers/UI can be
 * honest with users about provenance. Swapping in a real provider means
 * implementing `ValuationProvider` and passing it to `MarketValuationService`.
 */
export interface ValuationProvider {
  estimate(decoded: DecodedVehicle, mileageMiles: number): Promise<Sourced<ValuationEstimate>>;
}

const BODY_CLASS_MULTIPLIERS: Array<[RegExp, number]> = [
  [/truck|pickup/i, 1.35],
  [/suv|utility/i, 1.25],
  [/van/i, 1.05],
  [/convertible/i, 1.15],
  [/coupe/i, 1.1],
  [/sedan/i, 1.0],
  [/hatchback/i, 0.9]
];

function bodyClassMultiplier(bodyClass: string | null): number {
  if (!bodyClass) return 1.0;
  const match = BODY_CLASS_MULTIPLIERS.find(([pattern]) => pattern.test(bodyClass));
  return match ? match[1] : 1.0;
}

export class HeuristicValuationProvider implements ValuationProvider {
  async estimate(decoded: DecodedVehicle, mileageMiles: number): Promise<Sourced<ValuationEstimate>> {
    const currentYear = new Date().getFullYear();
    const age = decoded.modelYear ? Math.max(0, currentYear - decoded.modelYear) : 8;
    const horsepower = decoded.engineHorsepower ? Number(decoded.engineHorsepower) : 200;

    const baseValue = 22000 * bodyClassMultiplier(decoded.bodyClass) + Math.max(0, horsepower - 150) * 60;

    const ageDepreciation = baseValue * Math.min(0.72, age * 0.08);

    const expectedMileage = age * 12000;
    const mileageDelta = mileageMiles - expectedMileage;
    const mileageAdjustment = Math.max(-baseValue * 0.25, Math.min(baseValue * 0.15, -mileageDelta * 0.05));

    const retailValue = Math.max(1500, Math.round(baseValue - ageDepreciation + mileageAdjustment));
    const wholesaleValue = Math.round(retailValue * 0.82);
    const marketValue = Math.round((retailValue + wholesaleValue) / 2);

    return {
      value: { retailValue, wholesaleValue, marketValue },
      quality: 'estimated',
      source: 'heuristic-depreciation-curve (no paid pricing-data provider configured)'
    };
  }
}

export class MarketValuationService {
  constructor(private readonly provider: ValuationProvider = new HeuristicValuationProvider()) {}

  async valuate(decoded: DecodedVehicle, mileageMiles: number): Promise<Explained<Sourced<ValuationEstimate>>> {
    const result = await this.provider.estimate(decoded, mileageMiles);
    const age = decoded.modelYear ? new Date().getFullYear() - decoded.modelYear : null;

    const reasons = [
      decoded.bodyClass ? `Body class "${decoded.bodyClass}" applied as a value multiplier` : 'No body class decoded; used a neutral value multiplier',
      age != null ? `Vehicle age (${age} years) applied via depreciation curve` : 'Model year unknown; assumed a default age',
      `Mileage (${mileageMiles.toLocaleString()} mi) compared against expected mileage for this vehicle's age`,
      result.quality === 'estimated' ? 'No live pricing-data provider configured; values are a documented estimate, not a market quote' : `Sourced from ${result.source}`
    ];

    return { value: result, reasons };
  }
}

export const marketValuationService = new MarketValuationService();
