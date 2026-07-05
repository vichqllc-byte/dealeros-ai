import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-6 px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">DealersOS Phase 1</p>
      <h1 className="text-4xl font-bold">Production scaffold initialized.</h1>
      <p className="max-w-2xl text-lg text-neutral-700">
        This foundation replaces the static prototype with a real application structure for dealer, vendor, and admin workspaces.
      </p>
      <div className="flex gap-4">
        <Link className="rounded-lg bg-primary px-4 py-3 text-white" href="/dealer">Dealer app</Link>
        <Link className="rounded-lg border border-border px-4 py-3" href="/vendor">Vendor app</Link>
        <Link className="rounded-lg border border-border px-4 py-3" href="/admin">Admin app</Link>
      </div>
    </main>
  );
}
