'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildDamageAnalysisResults } from '@/lib/ai/damage-analysis';

type DamageAnalysisPanelProps = {
  items: Array<{ id: string; title: string; severity?: string | null; estimate?: number | null; confidence?: number | null }>;
};

export function DamageAnalysisPanel({ items }: DamageAnalysisPanelProps) {
  const results = useMemo(() => buildDamageAnalysisResults(items), [items]);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">AI Damage Analysis</h3>
          <p className="text-sm text-neutral-600">Damage triage and repair-cost estimates for incoming inventory.</p>
        </div>
        <Badge>Live DB</Badge>
      </div>
      <div className="grid gap-3">
        {results.map((item) => (
          <div key={item.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{item.title}</div>
              <Badge>{item.severity}</Badge>
            </div>
            <p className="mt-2 text-sm text-neutral-600">{item.summary}</p>
            <div className="mt-3 text-sm text-neutral-700">Estimated repair: ${item.estimatedRepairCost.toLocaleString()} • Confidence {Math.round(item.confidence * 100)}%</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
