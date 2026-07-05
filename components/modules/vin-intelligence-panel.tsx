'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildVinIntelligenceInsights, type VinIntelligenceInsight } from '@/lib/ai/vin-intelligence';

type VinIntelligencePanelProps = {
  items: Array<{ vin: string; mileage?: number | null; status?: string | null }>;
};

export function VinIntelligencePanel({ items }: VinIntelligencePanelProps) {
  const result = useMemo(() => buildVinIntelligenceInsights(items), [items]);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">VIN Intelligence</h3>
          <p className="text-sm text-neutral-600">AI-driven acquisition signal scoring for your current inventory.</p>
        </div>
        <Badge>{result.total} reviewed</Badge>
      </div>
      <div className="grid gap-3">
        {result.insights.map((insight) => (
          <div key={insight.vin} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{insight.vin}</div>
              <Badge>{insight.recommendation}</Badge>
            </div>
            <p className="mt-2 text-sm text-neutral-600">{insight.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {insight.flags.map((flag) => (
                <span key={flag} className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">{flag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
