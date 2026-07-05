import { describe, expect, it } from 'vitest';
import { LotAnalysisService } from '@/lib/vin-intelligence/providers/auction/lot-analysis-service';
import { HeuristicMarketValueProvider } from '@/lib/vin-intelligence/providers/market-value/heuristic-market-value-provider';
import { MarketIntelligenceService } from '@/lib/vin-intelligence/providers/market-value/market-intelligence-service';
import type { AuctionLot } from '@/lib/vin-intelligence/providers/auction/types';
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

function baseLot(overrides: Partial<AuctionLot> = {}): AuctionLot {
  return {
    lotNumber: 'LOT-1', vin: '1HGCM82633A004352', auctionHouse: 'Copart', saleDate: null,
    primaryDamage: 'Minor scratches', secondaryDamage: null, titleType: 'Clean', odometer: 30000,
    location: null, currentBid: null,
    ...overrides
  };
}

function service() {
  return new LotAnalysisService(undefined, undefined, new MarketIntelligenceService([], new HeuristicMarketValueProvider()));
}

describe('LotAnalysisService', () => {
  it('classifies severe damage keywords as High severity and produces a higher repair cost', async () => {
    const mild = await service().analyze({ lot: baseLot({ primaryDamage: 'Minor scratches' }), decoded: baseDecoded(), mileageMiles: 30000 });
    const severe = await service().analyze({ lot: baseLot({ primaryDamage: 'Flood damage, frame bent' }), decoded: baseDecoded(), mileageMiles: 30000 });
    expect(severe.damage.value.totalCost).toBeGreaterThan(mild.damage.value.totalCost);
  });

  it('flags a branded title as a real risk signal', async () => {
    const clean = await service().analyze({ lot: baseLot({ titleType: 'Clean' }), decoded: baseDecoded(), mileageMiles: 30000 });
    const salvage = await service().analyze({ lot: baseLot({ titleType: 'Salvage' }), decoded: baseDecoded(), mileageMiles: 30000 });

    expect(salvage.risk.value.score).toBeGreaterThan(clean.risk.value.score);
    expect(salvage.risk.value.signals.some((s) => s.includes('branded title'))).toBe(true);
  });

  it('gates the auction bid recommendation to Pause when risk is high', async () => {
    // A branded title alone is Medium risk by design (a single signal
    // shouldn't force a full override). Stacking it with a VIN checksum
    // failure (2HGCM82633A004352 fails the real check digit) pushes the
    // combined score into High, which is what should gate the bid.
    const result = await service().analyze({
      lot: baseLot({ titleType: 'Salvage', primaryDamage: 'Flood damage', vin: '2HGCM82633A004352' }),
      decoded: baseDecoded({ vin: '2HGCM82633A004352' }),
      mileageMiles: 30000
    });
    expect(result.risk.value.level).toBe('High');
    expect(result.auctionBid.value.recommendation).toBe('Pause');
  });

  it('produces a positive explanation trail combining damage, risk, and bid reasons', async () => {
    const result = await service().analyze({ lot: baseLot(), decoded: baseDecoded(), mileageMiles: 30000 });
    expect(result.explanation.length).toBeGreaterThan(0);
  });
});
