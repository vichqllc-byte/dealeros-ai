'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildPricingSummary, type PricingSummaryInput } from '@/lib/ai/pricing-summary';

type PricingSummaryPanelProps = {
  items: PricingSummaryInput[];
};

export function PricingSummaryPanel({ items }: PricingSummaryPanelProps) {
  const results = useMemo(() => buildPricingSummary(items), [items]);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pricing Summary</h3>
          <p className="text-sm text-neutral-600">Quick margin-based buying guidance for new lane opportunities.</p>
        </div>
        <Badge>Margin view</Badge>
      </div>
      <div className="grid gap-3">
        {results.map((item) => (
          <div key={item.title} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{item.title}</div>
              <Badge>{item.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-neutral-600">Estimated margin: ${item.margin.toLocaleString()} • {item.recommendation}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
