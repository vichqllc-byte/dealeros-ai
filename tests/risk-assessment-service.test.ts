import { describe, expect, it } from 'vitest';
import { assessVehicleRisk } from '@/lib/vin-intelligence/services/risk-assessment-service';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

function baseDecoded(overrides: Partial<DecodedVehicle> = {}): DecodedVehicle {
  return {
    vin: '1HGCM82633A004352',
    make: 'FORD', model: 'Mustang', modelYear: 2016, trim: null, series: null,
    bodyClass: 'Coupe', driveType: 'RWD', transmissionStyle: 'Manual', transmissionSpeeds: '6',
    engineCylinders: '8', engineDisplacementLiters: '5.0', engineHorsepower: '435',
    engineManufacturer: 'Ford', fuelTypePrimary: 'Gasoline', doors: '2',
    plantCity: 'FLAT ROCK', plantCountry: 'UNITED STATES', factoryOptions: [], safetyEquipment: ['ABS', 'ESC'],
    decodeErrorCode: null, decodeErrorText: null, decodeCompletenessPercent: 90, raw: {},
    ...overrides
  };
}

describe('assessVehicleRisk', () => {
  it('reports Low risk with no signals for a clean VIN', () => {
    const result = assessVehicleRisk({ decoded: baseDecoded() });
    expect(result.value.level).toBe('Low');
    expect(result.value.score).toBe(0);
  });

  it('flags a checksum mismatch as a high-weight signal', () => {
    // 2HGCM82633A004352 fails the real check digit.
    const result = assessVehicleRisk({ decoded: baseDecoded({ vin: '2HGCM82633A004352' }) });
    expect(result.value.signals.some((s) => s.includes('check digit'))).toBe(true);
    expect(result.value.score).toBeGreaterThan(0);
  });

  it('flags an NHTSA decode error code', () => {
    const result = assessVehicleRisk({ decoded: baseDecoded({ decodeErrorCode: '1', decodeErrorText: 'Check Digit does not calculate properly' }) });
    expect(result.value.signals.some((s) => s.includes('NHTSA decode'))).toBe(true);
  });

  it('flags a manually entered make/model/year mismatch against the decoded VIN', () => {
    const result = assessVehicleRisk({
      decoded: baseDecoded(),
      manualMake: 'Toyota',
      manualModel: 'Camry',
      manualYear: 2020
    });
    expect(result.value.signals.some((s) => s.includes('does not match decoded make'))).toBe(true);
    expect(result.value.signals.some((s) => s.includes('does not match decoded model'))).toBe(true);
    expect(result.value.signals.some((s) => s.includes('does not match decoded model year'))).toBe(true);
  });

  it('flags an odometer rollback against prior recorded mileage', () => {
    const result = assessVehicleRisk({
      decoded: baseDecoded(),
      currentMileage: 40000,
      priorMileageReadings: [65000]
    });
    expect(result.value.signals.some((s) => s.includes('Odometer anomaly'))).toBe(true);
    expect(result.value.level).not.toBe('Low');
  });

  it('does not flag mileage that has simply increased since the last reading', () => {
    const result = assessVehicleRisk({
      decoded: baseDecoded(),
      currentMileage: 70000,
      priorMileageReadings: [65000]
    });
    expect(result.value.signals.some((s) => s.includes('Odometer anomaly'))).toBe(false);
  });

  it('escalates to High risk when multiple signals stack', () => {
    const result = assessVehicleRisk({
      decoded: baseDecoded({ vin: '2HGCM82633A004352', decodeErrorCode: '1' }),
      manualMake: 'Toyota',
      currentMileage: 40000,
      priorMileageReadings: [65000]
    });
    expect(result.value.level).toBe('High');
  });
});
