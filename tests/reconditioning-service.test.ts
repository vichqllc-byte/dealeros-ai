import { describe, expect, it } from 'vitest';
import { ReconditioningService } from '@/lib/vin-intelligence/services/reconditioning-service';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

function baseDecoded(overrides: Partial<DecodedVehicle> = {}): DecodedVehicle {
  return {
    vin: '1HGCM82633A004352', make: 'FORD', model: 'Mustang', modelYear: new Date().getFullYear(),
    trim: null, series: null, bodyClass: 'Coupe', driveType: 'RWD', transmissionStyle: null,
    transmissionSpeeds: null, engineCylinders: null, engineDisplacementLiters: null, engineHorsepower: null,
    engineManufacturer: null, fuelTypePrimary: null, doors: null, plantCity: null, plantCountry: null,
    factoryOptions: [], safetyEquipment: [], decodeErrorCode: null, decodeErrorText: null,
    decodeCompletenessPercent: 90, raw: {},
    ...overrides
  };
}

describe('ReconditioningService', () => {
  it('always includes detail, photo, and inspection tasks', () => {
    const service = new ReconditioningService();
    const result = service.buildPlan({ mileageMiles: 10000, decoded: baseDecoded(), riskLevel: 'Low' });
    const ids = result.value.tasks.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['detail', 'photograph', 'inspection']));
  });

  it('adds tire and brake tasks for higher-mileage vehicles', () => {
    const service = new ReconditioningService();
    const lowMileage = service.buildPlan({ mileageMiles: 10000, decoded: baseDecoded(), riskLevel: 'Low' });
    const highMileage = service.buildPlan({ mileageMiles: 90000, decoded: baseDecoded(), riskLevel: 'Low' });
    expect(highMileage.value.tasks.some((t) => t.id === 'tires')).toBe(true);
    expect(lowMileage.value.tasks.some((t) => t.id === 'tires')).toBe(false);
    expect(highMileage.value.totalCost).toBeGreaterThan(lowMileage.value.totalCost);
  });

  it('adds a timing service task for older vehicles', () => {
    const service = new ReconditioningService();
    const older = service.buildPlan({ mileageMiles: 30000, decoded: baseDecoded({ modelYear: new Date().getFullYear() - 8 }), riskLevel: 'Low' });
    expect(older.value.tasks.some((t) => t.id === 'timing-service')).toBe(true);
  });
});
