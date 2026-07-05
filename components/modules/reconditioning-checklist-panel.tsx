'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildReconditioningChecklist, type ReconditioningChecklistItem } from '@/lib/ai/reconditioning-checklist';

type ReconditioningChecklistPanelProps = {
  items: ReconditioningChecklistItem[];
};

export function ReconditioningChecklistPanel({ items }: ReconditioningChecklistPanelProps) {
  const summary = useMemo(() => buildReconditioningChecklist(items), [items]);

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Reconditioning Checklist</h3>
          <p className="text-sm text-neutral-600">Track the work needed before the unit is ready to sell.</p>
        </div>
        <Badge>{summary.completionPercent}% done</Badge>
      </div>
      <div className="rounded-xl border border-border p-3">
        <div className="text-sm font-medium">Next action: {summary.nextAction ?? 'All tasks complete'}</div>
        <div className="mt-2 text-sm text-neutral-600">{summary.completedCount}/{summary.totalCount} completed</div>
      </div>
    </Card>
  );
}
