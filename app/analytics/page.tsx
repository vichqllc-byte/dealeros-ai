import { DashboardShell } from '@/components/dashboard-shell';
import { Card } from '@/components/ui/card';
import { requireSession } from '@/lib/server/require-session';
import { getAnalyticsForOrg } from '@/lib/server/analytics-service';

export default async function AnalyticsPage() {
  const session = await requireSession(['DEALER_OWNER', 'DEALER_BUYER', 'ADMIN']);
  const analytics = await getAnalyticsForOrg(session.organizationId);

  return (
    <DashboardShell title="Analytics Dashboard" subtitle="Pipeline health, close rate, and channel performance.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card><div className="text-sm text-neutral-500">Vehicles</div><div className="mt-2 text-3xl font-bold">{analytics.vehicleCount}</div></Card>
        <Card><div className="text-sm text-neutral-500">Customers</div><div className="mt-2 text-3xl font-bold">{analytics.customerCount}</div></Card>
        <Card><div className="text-sm text-neutral-500">Deals</div><div className="mt-2 text-3xl font-bold">{analytics.dealCount}</div></Card>
        <Card><div className="text-sm text-neutral-500">Won deals</div><div className="mt-2 text-3xl font-bold">{analytics.wonDeals}</div></Card>
        <Card><div className="text-sm text-neutral-500">Close rate</div><div className="mt-2 text-3xl font-bold">{Math.round(analytics.closeRate * 100)}%</div></Card>
        <Card><div className="text-sm text-neutral-500">Pipeline value</div><div className="mt-2 text-3xl font-bold">${analytics.pipelineValue.toLocaleString()}</div></Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="text-sm font-semibold text-neutral-700">Deal stage breakdown</div>
          <div className="mt-3 space-y-2">
            {Object.entries(analytics.stageBreakdown).map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-3">
                <div className="w-28 text-xs uppercase tracking-[0.15em] text-neutral-500">{stage}</div>
                <div className="h-2 flex-1 rounded bg-neutral-200">
                  <div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, count * 14)}%` }} />
                </div>
                <div className="w-8 text-right text-sm text-neutral-700">{count}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold text-neutral-700">Marketplace channel status</div>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            {Object.entries(analytics.channelBreakdown).map(([key, count]) => (
              <li key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span>{key}</span>
                <span className="font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </DashboardShell>
  );
}
