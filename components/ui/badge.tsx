import { cn } from '@/lib/utils';

export function Badge({ className = '', ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800', className)} {...props} />;
}
