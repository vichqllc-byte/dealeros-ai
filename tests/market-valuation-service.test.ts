import { describe, expect, it } from 'vitest';
import { MarketValuationService, HeuristicValuationProvider } from '@/lib/vin-intelligence/services/market-valuation-service';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

function baseDecoded(overrides: Partial<DecodedVehicle> = {}): DecodedVehicle {
  return {
    vin: '1HGCM82633A004352', make: 'FORD', model: 'Mustang', modelYear: new Date().getFullYear(),
    trim: null, series: null, bodyClass: 'Sedan', driveType: 'RWD', transmissionStyle: null,
    transmissionSpeeds: null, engineCylinders: null, engineDisplacementLiters: null, engineHorsepower: '200',
    engineManufacturer: null, fuelTypePrimary: null, doors: null, plantCity: null, plantCountry: null,
    factoryOptions: [], safetyEquipment: [], decodeErrorCode: null, decodeErrorText: null,
    decodeCompletenessPercent: 90, raw: {},
    ...overrides
  };
}

describe('MarketValuationService', () => {
  it('tags results as estimated with the heuristic provider (no paid data source configured)', async () => {
    const service = new MarketValuationService();
    const result = await service.valuate(baseDecoded(), 10000);
    expect(result.value.quality).toBe('estimated');
    expect(result.reasons.some((r) => r.includes('estimate'))).toBe(true);
  });

  it('produces internally consistent wholesale <= market <= retail ordering', async () => {
    const provider = new HeuristicValuationProvider();
    const result = await provider.estimate(baseDecoded(), 10000);
    expect(result.value.wholesaleValue).toBeLessThanOrEqual(result.value.marketValue);
    expect(result.value.marketValue).toBeLessThanOrEqual(result.value.retailValue);
  });

  it('reduces value for a higher-mileage vehicle of the same age', async () => {
    const provider = new HeuristicValuationProvider();
    const decoded = baseDecoded({ modelYear: new Date().getFullYear() - 5 });
    const lowMileage = await provider.estimate(decoded, 20000);
    const highMileage = await provider.estimate(decoded, 120000);
    expect(highMileage.value.retailValue).toBeLessThan(lowMileage.value.retailValue);
  });

  it('reduces value for an older vehicle at the same mileage', async () => {
    const provider = new HeuristicValuationProvider();
    const newer = await provider.estimate(baseDecoded({ modelYear: new Date().getFullYear() - 1 }), 40000);
    const older = await provider.estimate(baseDecoded({ modelYear: new Date().getFullYear() - 10 }), 40000);
    expect(older.value.retailValue).toBeLessThan(newer.value.retailValue);
  });

  it('applies a higher multiplier for truck/SUV body classes than sedans', async () => {
    const provider = new HeuristicValuationProvider();
    const sedan = await provider.estimate(baseDecoded({ bodyClass: 'Sedan' }), 30000);
    const truck = await provider.estimate(baseDecoded({ bodyClass: 'Pickup' }), 30000);
    expect(truck.value.retailValue).toBeGreaterThan(sedan.value.retailValue);
  });
});
