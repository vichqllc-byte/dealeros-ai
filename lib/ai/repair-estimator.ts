export type RepairEstimatorInput = {
  id: string;
  title: string;
  laborHours?: number | null;
  materialCost?: number | null;
  paintCost?: number | null;
  urgency?: string | null;
};

export type RepairEstimatorResult = {
  id: string;
  title: string;
  estimatedCost: number;
  urgency: string;
  recommendation: 'Plan repair' | 'Fast-track' | 'Hold';
};

export function buildRepairEstimatorResults(items: RepairEstimatorInput[]): RepairEstimatorResult[] {
  return items.map((item) => {
    const laborHours = item.laborHours ?? 4;
    const materialCost = item.materialCost ?? 400;
    const paintCost = item.paintCost ?? 300;
    const laborCost = laborHours * 95;
    const estimatedCost = laborCost + materialCost + paintCost;
    const urgency = (item.urgency ?? 'Medium').toString();
    const recommendation = estimatedCost >= 3000 || urgency === 'High' ? 'Fast-track' : estimatedCost >= 1800 ? 'Plan repair' : 'Hold';

    return {
      id: item.id,
      title: item.title,
      estimatedCost,
      urgency,
      recommendation
    };
  });
}
