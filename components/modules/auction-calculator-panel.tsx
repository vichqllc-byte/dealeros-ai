'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildAuctionCalculatorResults, type AuctionCalculatorInput } from '@/lib/ai/auction-calculator';

type AuctionCalculatorPanelProps = {
  items: AuctionCalculatorInput[];
};

export function AuctionCalculatorPanel({ items }: AuctionCalculatorPanelProps) {
  const results = useMemo(() => buildAuctionCalculatorResults(items), [items]);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Auction Bid Planner</h3>
          <p className="text-sm text-neutral-600">Estimate a safe max bid before you chase a lane.</p>
        </div>
        <Badge>AI assisted</Badge>
      </div>
      <div className="grid gap-3">
        {results.map((item) => (
          <div key={item.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{item.title}</div>
              <Badge>{item.recommendation}</Badge>
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Max bid: ${item.maxBid.toLocaleString()} • Projected profit: ${item.projectedProfit.toLocaleString()}
            </p>
            <div className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-500">
              Confidence {Math.round(item.confidence * 100)}%
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
