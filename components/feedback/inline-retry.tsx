'use client';

import { Button } from '@/components/ui/button';

export function InlineRetry({ title, description, onRetry }: { title: string; description: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="text-sm font-semibold text-amber-800">{title}</div>
      <div className="mt-1 text-sm text-amber-700">{description}</div>
      <Button className="mt-3" onClick={onRetry}>Retry</Button>
    </div>
  );
}
