import { requireSession } from '@/lib/server/require-session';

export default async function DealerLayout({ children }: { children: React.ReactNode }) {
  await requireSession(['DEALER_OWNER', 'DEALER_BUYER', 'ADMIN']);
  return children;
}
