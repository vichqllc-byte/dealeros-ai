'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildRepairEstimatorResults, type RepairEstimatorInput } from '@/lib/ai/repair-estimator';

type RepairEstimatorPanelProps = {
  items: RepairEstimatorInput[];
};

export function RepairEstimatorPanel({ items }: RepairEstimatorPanelProps) {
  const results = useMemo(() => buildRepairEstimatorResults(items), [items]);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Repair Budget Estimator</h3>
          <p className="text-sm text-neutral-600">Quick cost planning for damage repair and reconditioning.</p>
        </div>
        <Badge>Fast estimate</Badge>
      </div>
      <div className="grid gap-3">
        {results.map((item) => (
          <div key={item.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{item.title}</div>
              <Badge>{item.recommendation}</Badge>
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Estimated repair: ${item.estimatedCost.toLocaleString()} • Urgency {item.urgency}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
