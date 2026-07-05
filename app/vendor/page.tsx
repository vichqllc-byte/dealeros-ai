import { DashboardShell } from '@/components/dashboard-shell';
import { Card } from '@/components/ui/card';
import { requireSession } from '@/lib/server/require-session';
import { loadVendorDashboard } from '@/lib/loaders/dashboard';

export default async function VendorPage() {
  const session = await requireSession(['VENDOR_MANAGER', 'ADMIN']);
  const data = await loadVendorDashboard(session.organizationId);

  return (
    <DashboardShell title="Vendor Workspace" subtitle="Quote requests, repair estimates, scheduling, and communication.">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="text-sm text-neutral-500">Open quote requests</div>
          <div className="mt-2 text-3xl font-bold">{data.quoteRequestsOpen}</div>
        </Card>
        <Card>
          <div className="text-sm text-neutral-500">Active jobs</div>
          <div className="mt-2 text-3xl font-bold">{data.activeJobs}</div>
        </Card>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="text-sm font-semibold text-neutral-700">Recent collaboration</div>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {data.recentMessages.map((item) => <li key={item.id} className="rounded-lg border border-border p-2">{item.body}</li>)}
          </ul>
        </Card>
        <Card>
          <div className="text-sm font-semibold text-neutral-700">Vendor workflow readiness</div>
          <p className="mt-3 text-sm text-neutral-600">Quote and repair operations now surface as live workflow state from the shared dealership system, making vendor handoffs more actionable.</p>
        </Card>
      </div>
    </DashboardShell>
  );
}
