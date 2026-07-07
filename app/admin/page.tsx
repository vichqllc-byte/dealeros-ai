import { DashboardShell } from '@/components/dashboard-shell';
import { Card } from '@/components/ui/card';
import { requireSession } from '@/lib/server/require-session';
import { loadAdminDashboard } from '@/lib/loaders/dashboard';

export default async function AdminPage() {
  const session = await requireSession(['ADMIN']);
  const data = await loadAdminDashboard(session.organizationId);

  return (
    <DashboardShell title="Admin Workspace" subtitle="Organizations, permissions, billing, audit, and AI service health.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><div className="text-sm text-neutral-500">Organization</div><div className="mt-2 text-xl font-bold">{data.organizationName}</div></Card>
        <Card><div className="text-sm text-neutral-500">Users</div><div className="mt-2 text-3xl font-bold">{data.userCount}</div></Card>
        <Card><div className="text-sm text-neutral-500">Vehicles</div><div className="mt-2 text-3xl font-bold">{data.vehicleCount}</div></Card>
        <Card><div className="text-sm text-neutral-500">Customers</div><div className="mt-2 text-3xl font-bold">{data.customerCount}</div></Card>
        <Card><div className="text-sm text-neutral-500">Deals</div><div className="mt-2 text-3xl font-bold">{data.dealCount}</div></Card>
        <Card><div className="text-sm text-neutral-500">Audit entries</div><div className="mt-2 text-3xl font-bold">{data.auditCount}</div></Card>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="text-sm font-semibold text-neutral-700">Recent activity</div>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {data.recentActivity.map((item) => <li key={item.id} className="rounded-lg border border-border p-2">{item.summary} <span className="text-neutral-500">({item.type})</span></li>)}
          </ul>
        </Card>
        <Card>
          <div className="text-sm font-semibold text-neutral-700">Recent audit</div>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {data.recentAudit.map((item) => <li key={item.id} className="rounded-lg border border-border p-2">{item.action} • {item.entityType}</li>)}
          </ul>
        </Card>
      </div>
    </DashboardShell>
  );
}
