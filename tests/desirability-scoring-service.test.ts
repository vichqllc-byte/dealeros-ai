import { describe, expect, it } from 'vitest';
import { DesirabilityScoringService } from '@/lib/vin-intelligence/services/desirability-scoring-service';
import type { DecodedVehicle, Recall, RiskAssessment } from '@/lib/vin-intelligence/types';

function baseDecoded(overrides: Partial<DecodedVehicle> = {}): DecodedVehicle {
  return {
    vin: '1HGCM82633A004352', make: 'FORD', model: 'Mustang', modelYear: new Date().getFullYear() - 3,
    trim: null, series: null, bodyClass: 'Coupe', driveType: 'RWD', transmissionStyle: null,
    transmissionSpeeds: null, engineCylinders: null, engineDisplacementLiters: null, engineHorsepower: null,
    engineManufacturer: null, fuelTypePrimary: null, doors: null, plantCity: null, plantCountry: null,
    factoryOptions: [], safetyEquipment: [], decodeErrorCode: null, decodeErrorText: null,
    decodeCompletenessPercent: 90, raw: {},
    ...overrides
  };
}

const lowRisk: RiskAssessment = { level: 'Low', score: 0, signals: [] };
const highRisk: RiskAssessment = { level: 'High', score: 60, signals: ['signal'] };

describe('DesirabilityScoringService', () => {
  it('scores lower for a vehicle with open recalls', () => {
    const service = new DesirabilityScoringService();
    const recall: Recall = { campaignNumber: '1', component: 'BRAKES', summary: '', consequence: '', remedy: '', reportedAt: '' };
    const withRecall = service.score({ decoded: baseDecoded(), mileageMiles: 36000, recalls: [recall], risk: lowRisk });
    const withoutRecall = service.score({ decoded: baseDecoded(), mileageMiles: 36000, recalls: [], risk: lowRisk });
    expect(withRecall.value).toBeLessThan(withoutRecall.value);
  });

  it('scores lower for high risk vehicles', () => {
    const service = new DesirabilityScoringService();
    const highRiskScore = service.score({ decoded: baseDecoded(), mileageMiles: 36000, recalls: [], risk: highRisk });
    const lowRiskScore = service.score({ decoded: baseDecoded(), mileageMiles: 36000, recalls: [], risk: lowRisk });
    expect(highRiskScore.value).toBeLessThan(lowRiskScore.value);
  });

  it('scores higher for below-average mileage for the vehicle\'s age', () => {
    const service = new DesirabilityScoringService();
    const lowMileage = service.score({ decoded: baseDecoded(), mileageMiles: 10000, recalls: [], risk: lowRisk });
    const highMileage = service.score({ decoded: baseDecoded(), mileageMiles: 100000, recalls: [], risk: lowRisk });
    expect(lowMileage.value).toBeGreaterThan(highMileage.value);
  });

  it('stays within the 0-100 bounds', () => {
    const service = new DesirabilityScoringService();
    const result = service.score({ decoded: baseDecoded({ decodeCompletenessPercent: 10 }), mileageMiles: 300000, recalls: [{ campaignNumber: '1', component: '', summary: '', consequence: '', remedy: '', reportedAt: '' }, { campaignNumber: '2', component: '', summary: '', consequence: '', remedy: '', reportedAt: '' }, { campaignNumber: '3', component: '', summary: '', consequence: '', remedy: '', reportedAt: '' }], risk: highRisk });
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(100);
  });
});
