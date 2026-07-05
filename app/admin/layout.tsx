import { requireSession } from '@/lib/server/require-session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSession(['ADMIN']);
  return children;
}
