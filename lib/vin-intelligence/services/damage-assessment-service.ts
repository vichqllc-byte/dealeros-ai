import type { Explained, RepairEstimate } from '@/lib/vin-intelligence/types';

export type DamageReport = {
  id: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High';
};

// Parameterized shop-rate table (labor hours and paint/materials cost by
// severity) rather than fabricated per-vehicle numbers - the same rates
// apply consistently across every assessment, and are the values a real
// shop-rate integration would override.
const LABOR_RATE_PER_HOUR = 95;
const SEVERITY_LABOR_HOURS: Record<DamageReport['severity'], number> = { Low: 2, Medium: 5, High: 9 };
const SEVERITY_MATERIALS_COST: Record<DamageReport['severity'], number> = { Low: 250, Medium: 450, High: 750 };

export class DamageAssessmentService {
  assess(reports: DamageReport[]): Explained<RepairEstimate> {
    const lineItems = reports.map((report) => {
      const laborCost = SEVERITY_LABOR_HOURS[report.severity] * LABOR_RATE_PER_HOUR;
      const materialsCost = SEVERITY_MATERIALS_COST[report.severity];
      return {
        id: report.id,
        title: report.title,
        severity: report.severity,
        estimatedCost: Math.round(laborCost + materialsCost)
      };
    });

    const totalCost = lineItems.reduce((sum, item) => sum + item.estimatedCost, 0);

    const reasons = reports.length === 0
      ? ['No damage reported']
      : lineItems.map((item) => `${item.title} (${item.severity}): ${SEVERITY_LABOR_HOURS[reports.find((r) => r.id === item.id)!.severity]}h labor @ $${LABOR_RATE_PER_HOUR}/h + materials`);

    return { value: { lineItems, totalCost }, reasons };
  }
}

export const damageAssessmentService = new DamageAssessmentService();
