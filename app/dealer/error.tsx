'use client';

import { Button } from '@/components/ui/button';

export default function DealerError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h2 className="text-2xl font-semibold">Dealer workspace error</h2>
      <p className="mt-2 text-neutral-600">{error.message}</p>
      <Button className="mt-4" onClick={() => reset()}>Retry workspace</Button>
    </div>
  );
}
