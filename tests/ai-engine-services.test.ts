import { describe, expect, it } from 'vitest';
import { TimeToSellService } from '@/lib/vin-intelligence/services/time-to-sell-service';
import { DemandPredictionService } from '@/lib/vin-intelligence/services/demand-prediction-service';
import { DepreciationForecastService } from '@/lib/vin-intelligence/services/depreciation-forecast-service';
import { DealerRoiService } from '@/lib/vin-intelligence/services/dealer-roi-service';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

function baseDecoded(overrides: Partial<DecodedVehicle> = {}): DecodedVehicle {
  return {
    vin: '1HGCM82633A004352', make: 'FORD', model: 'F-150', modelYear: new Date().getFullYear() - 2,
    trim: null, series: null, bodyClass: 'Pickup', driveType: '4WD', transmissionStyle: null,
    transmissionSpeeds: null, engineCylinders: null, engineDisplacementLiters: null, engineHorsepower: null,
    engineManufacturer: null, fuelTypePrimary: null, doors: null, plantCity: null, plantCountry: null,
    factoryOptions: [], safetyEquipment: [], decodeErrorCode: null, decodeErrorText: null,
    decodeCompletenessPercent: 90, raw: {},
    ...overrides
  };
}

describe('TimeToSellService', () => {
  it('predicts fewer days for a highly desirable, competitively priced vehicle', () => {
    const service = new TimeToSellService();
    const desirable = service.predict({ desirabilityScore: 90, askingPrice: 18000, marketValue: 20000 });
    const undesirable = service.predict({ desirabilityScore: 20, askingPrice: 25000, marketValue: 20000 });
    expect(desirable.value).toBeLessThan(undesirable.value);
  });

  it('stays within a sane 5-180 day bound', () => {
    const service = new TimeToSellService();
    const result = service.predict({ desirabilityScore: 100, askingPrice: 1, marketValue: 100000 });
    expect(result.value).toBeGreaterThanOrEqual(5);
    expect(result.value).toBeLessThanOrEqual(180);
  });
});

describe('DemandPredictionService', () => {
  it('predicts higher demand for trucks/SUVs at the same desirability score', () => {
    const service = new DemandPredictionService();
    const truck = service.predict({ decoded: baseDecoded({ bodyClass: 'Pickup' }), desirabilityScore: 55 });
    const wagon = service.predict({ decoded: baseDecoded({ bodyClass: 'Wagon' }), desirabilityScore: 55 });
    const order = { Low: 0, Medium: 1, High: 2 };
    expect(order[truck.value]).toBeGreaterThanOrEqual(order[wagon.value]);
  });
});

describe('DepreciationForecastService', () => {
  it('projects decreasing value further into the future', () => {
    const service = new DepreciationForecastService();
    const result = service.forecast(20000);
    const values = result.value.map((p) => p.projectedValue);
    expect(values[0]).toBeGreaterThan(values[1]);
    expect(values[1]).toBeGreaterThan(values[2]);
  });

  it('honors custom horizons', () => {
    const service = new DepreciationForecastService();
    const result = service.forecast(10000, [3]);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].monthsFromNow).toBe(3);
    expect(result.value[0].projectedValue).toBeLessThan(10000);
  });
});

describe('DealerRoiService', () => {
  it('annualizes ROI over the holding period', () => {
    const service = new DealerRoiService();
    const result = service.score({ projectedRoi: 0.1, estimatedHoldingDays: 36.5 });
    // 0.1 * (365/36.5) = 1.0
    expect(result.value).toBeCloseTo(1.0, 2);
  });

  it('rewards a faster flip at the same total ROI', () => {
    const service = new DealerRoiService();
    const fast = service.score({ projectedRoi: 0.1, estimatedHoldingDays: 15 });
    const slow = service.score({ projectedRoi: 0.1, estimatedHoldingDays: 90 });
    expect(fast.value).toBeGreaterThan(slow.value);
  });
});
