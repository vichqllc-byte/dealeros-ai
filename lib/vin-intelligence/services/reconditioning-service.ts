import type { DecodedVehicle, Explained, ReconditioningPlan, RiskLevel } from '@/lib/vin-intelligence/types';

const BASE_TASK_COST = { detail: 180, photograph: 40, inspection: 120, tires: 620, brakes: 380, timingService: 950 };

/**
 * Builds a reconditioning task list from real vehicle attributes (mileage,
 * age, risk level) rather than a fixed fake checklist - every vehicle gets
 * a different plan depending on its actual condition signals.
 */
export class ReconditioningService {
  buildPlan(input: { mileageMiles: number; decoded: DecodedVehicle; riskLevel: RiskLevel }): Explained<ReconditioningPlan> {
    const tasks: ReconditioningPlan['tasks'] = [
      { id: 'detail', title: 'Full detail', estimatedCost: BASE_TASK_COST.detail, completed: false },
      { id: 'photograph', title: 'Photograph for listing', estimatedCost: BASE_TASK_COST.photograph, completed: false },
      { id: 'inspection', title: 'Multi-point safety inspection', estimatedCost: BASE_TASK_COST.inspection, completed: false }
    ];
    const reasons = ['Every intake vehicle receives a detail, listing photos, and a safety inspection'];

    if (input.mileageMiles > 60000) {
      tasks.push({ id: 'tires', title: 'Replace worn tires', estimatedCost: BASE_TASK_COST.tires, completed: false });
      reasons.push(`Mileage (${input.mileageMiles.toLocaleString()} mi) exceeds 60,000 - tire wear is likely`);
    }

    if (input.mileageMiles > 45000) {
      tasks.push({ id: 'brakes', title: 'Brake pad/rotor service', estimatedCost: BASE_TASK_COST.brakes, completed: false });
      reasons.push(`Mileage (${input.mileageMiles.toLocaleString()} mi) exceeds 45,000 - brake service is a common next-owner expectation`);
    }

    const age = input.decoded.modelYear ? new Date().getFullYear() - input.decoded.modelYear : null;
    if (age != null && age >= 7) {
      tasks.push({ id: 'timing-service', title: 'Timing/drive belt service', estimatedCost: BASE_TASK_COST.timingService, completed: false });
      reasons.push(`Vehicle age (${age} years) warrants a timing/drive belt service check`);
    }

    if (input.riskLevel === 'High') {
      reasons.push('Elevated risk assessment - recommend a more thorough pre-sale inspection before listing');
    }

    const totalCost = tasks.reduce((sum, task) => sum + task.estimatedCost, 0);
    const completedCount = tasks.filter((t) => t.completed).length;
    const completionPercent = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

    return { value: { tasks, totalCost, completionPercent }, reasons };
  }
}

export const reconditioningService = new ReconditioningService();
