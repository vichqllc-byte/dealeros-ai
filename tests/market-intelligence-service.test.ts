import { describe, expect, it, vi } from 'vitest';
import { HeuristicMarketValueProvider } from '@/lib/vin-intelligence/providers/market-value/heuristic-market-value-provider';
import { MarketIntelligenceService } from '@/lib/vin-intelligence/providers/market-value/market-intelligence-service';
import type { MarketValueProvider } from '@/lib/vin-intelligence/providers/market-value/types';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

function baseDecoded(overrides: Partial<DecodedVehicle> = {}): DecodedVehicle {
  return {
    vin: '1HGCM82633A004352', make: 'FORD', model: 'Mustang', modelYear: new Date().getFullYear() - 3,
    trim: null, series: null, bodyClass: 'Coupe', driveType: 'RWD', transmissionStyle: null,
    transmissionSpeeds: null, engineCylinders: null, engineDisplacementLiters: null, engineHorsepower: '300',
    engineManufacturer: null, fuelTypePrimary: null, doors: null, plantCity: null, plantCountry: null,
    factoryOptions: [], safetyEquipment: [], decodeErrorCode: null, decodeErrorText: null,
    decodeCompletenessPercent: 90, raw: {},
    ...overrides
  };
}

describe('HeuristicMarketValueProvider', () => {
  it('produces all six value types tagged as estimated', async () => {
    const provider = new HeuristicMarketValueProvider();
    const result = await provider.getValues(baseDecoded(), 30000);

    expect(result.quality).toBe('estimated');
    expect(Object.keys(result.values).sort()).toEqual(['auction', 'dealerRetail', 'insurance', 'privateParty', 'tradeIn', 'wholesale'].sort());
    expect(result.values.wholesale).toBeLessThan(result.values.dealerRetail);
    expect(result.values.auction).toBeLessThan(result.values.wholesale);
  });

  it('scales confidence with decode completeness', async () => {
    const provider = new HeuristicMarketValueProvider();
    const highCompleteness = await provider.getValues(baseDecoded({ decodeCompletenessPercent: 95 }), 30000);
    const lowCompleteness = await provider.getValues(baseDecoded({ decodeCompletenessPercent: 10 }), 30000);
    expect(highCompleteness.confidenceScore).toBeGreaterThan(lowCompleteness.confidenceScore);
  });
});

describe('MarketIntelligenceService', () => {
  it('falls back to the heuristic provider when no premium providers are configured', async () => {
    const service = new MarketIntelligenceService([], new HeuristicMarketValueProvider());
    const result = await service.getMarketValues(baseDecoded(), 20000);
    expect(result.quality).toBe('estimated');
  });

  it('uses the first available premium provider', async () => {
    const premium: MarketValueProvider = {
      name: 'test-premium',
      isAvailable: () => true,
      getValues: vi.fn(async () => ({
        values: { dealerRetail: 1, wholesale: 1, auction: 1, privateParty: 1, tradeIn: 1, insurance: 1 },
        confidenceScore: 0.99, quality: 'real' as const, source: 'test-premium', reasons: []
      }))
    };
    const service = new MarketIntelligenceService([premium], new HeuristicMarketValueProvider());
    const result = await service.getMarketValues(baseDecoded(), 20000);
    expect(result.source).toBe('test-premium');
    expect(result.quality).toBe('real');
  });

  it('skips an unavailable premium provider and falls through to the next', async () => {
    const unavailable: MarketValueProvider = { name: 'unavailable', isAvailable: () => false, getValues: vi.fn() };
    const service = new MarketIntelligenceService([unavailable], new HeuristicMarketValueProvider());
    const result = await service.getMarketValues(baseDecoded(), 20000);
    expect(unavailable.getValues).not.toHaveBeenCalled();
    expect(result.quality).toBe('estimated');
  });

  it('falls back to the heuristic provider if a configured premium provider throws', async () => {
    const failing: MarketValueProvider = {
      name: 'failing', isAvailable: () => true, getValues: vi.fn(async () => { throw new Error('vendor outage'); })
    };
    const service = new MarketIntelligenceService([failing], new HeuristicMarketValueProvider());
    const result = await service.getMarketValues(baseDecoded(), 20000);
    expect(result.quality).toBe('estimated');
  });
});
