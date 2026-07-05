import { cn } from '@/lib/utils';

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('min-h-11 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm')} {...props} />;
}
