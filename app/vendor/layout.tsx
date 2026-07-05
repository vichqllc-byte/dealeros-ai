import { requireSession } from '@/lib/server/require-session';

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  await requireSession(['VENDOR_MANAGER', 'ADMIN']);
  return children;
}
