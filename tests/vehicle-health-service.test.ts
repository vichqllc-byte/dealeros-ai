import { describe, expect, it } from 'vitest';
import { VehicleHealthService } from '@/lib/vin-intelligence/services/vehicle-health-service';
import type { Recall, RepairEstimate, RiskAssessment } from '@/lib/vin-intelligence/types';

const noRepair: RepairEstimate = { lineItems: [], totalCost: 0 };
const lowRisk: RiskAssessment = { level: 'Low', score: 0, signals: [] };

describe('VehicleHealthService', () => {
  it('scores Excellent for a clean vehicle with no recalls, risk, or repair cost', () => {
    const service = new VehicleHealthService();
    const result = service.score({ recalls: [], risk: lowRisk, repairEstimate: noRepair, decodeCompletenessPercent: 95 });
    expect(result.value.label).toBe('Excellent');
  });

  it('reduces score for open recalls', () => {
    const service = new VehicleHealthService();
    const recall: Recall = { campaignNumber: '1', component: '', summary: '', consequence: '', remedy: '', reportedAt: '' };
    const withRecalls = service.score({ recalls: [recall, recall, recall], risk: lowRisk, repairEstimate: noRepair, decodeCompletenessPercent: 95 });
    const withoutRecalls = service.score({ recalls: [], risk: lowRisk, repairEstimate: noRepair, decodeCompletenessPercent: 95 });
    expect(withRecalls.value.score).toBeLessThan(withoutRecalls.value.score);
  });

  it('reduces score for high repair costs', () => {
    const service = new VehicleHealthService();
    const expensive: RepairEstimate = { lineItems: [], totalCost: 5000 };
    const result = service.score({ recalls: [], risk: lowRisk, repairEstimate: expensive, decodeCompletenessPercent: 95 });
    expect(result.value.score).toBeLessThan(90);
  });

  it('stays within 0-100 bounds under maximally bad inputs', () => {
    const service = new VehicleHealthService();
    const highRisk: RiskAssessment = { level: 'High', score: 100, signals: ['a'] };
    const expensive: RepairEstimate = { lineItems: [], totalCost: 50000 };
    const recall: Recall = { campaignNumber: '1', component: '', summary: '', consequence: '', remedy: '', reportedAt: '' };
    const result = service.score({ recalls: [recall, recall, recall, recall, recall], risk: highRisk, repairEstimate: expensive, decodeCompletenessPercent: 5 });
    expect(result.value.score).toBeGreaterThanOrEqual(0);
    expect(result.value.label).toBe('Poor');
  });
});
