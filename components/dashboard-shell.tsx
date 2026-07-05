import Link from 'next/link';

export function DashboardShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-[240px_1fr]">
        <aside className="border-r border-border bg-surface p-6">
          <div className="mb-8">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">DealersOS</div>
            <h1 className="mt-2 text-xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
          </div>
          <nav className="grid gap-2 text-sm">
            <Link href="/dealer">Dealer</Link>
            <Link href="/vendor">Vendor</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </aside>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
