import { DashboardShell } from '@/components/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DealerWorkspaceClient } from '@/components/forms/dealer-workspace-client';
import { VinIntelligencePanel } from '@/components/modules/vin-intelligence-panel';
import { DamageAnalysisPanel } from '@/components/modules/damage-analysis-panel';
import { AuctionCalculatorPanel } from '@/components/modules/auction-calculator-panel';
import { RepairEstimatorPanel } from '@/components/modules/repair-estimator-panel';
import { PricingSummaryPanel } from '@/components/modules/pricing-summary-panel';
import { ReconditioningChecklistPanel } from '@/components/modules/reconditioning-checklist-panel';
import { requireSession } from '@/lib/server/require-session';
import { loadDealerDashboard } from '@/lib/loaders/dashboard';
import { summarizeWorkflowStates } from '@/lib/ai/workflow-summary';

export default async function DealerPage() {
  const session = await requireSession(['DEALER_OWNER', 'DEALER_BUYER', 'ADMIN']);

  try {
    const data = await loadDealerDashboard(session.organizationId);
    const workflowSummary = summarizeWorkflowStates(data.recentVehicles, data.analyses);
    return (
      <DashboardShell title="Dealer Workspace" subtitle="Acquisition pipeline, VIN analysis, sourcing, and profit view.">
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <div className="text-sm text-neutral-500">Vehicles</div>
              <div className="mt-2 text-3xl font-bold">{data.vehicleCount}</div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-neutral-500">Analyzed</div>
                  <div className="mt-2 text-3xl font-bold">{data.analyzedCount}</div>
                </div>
                <Badge>Live DB</Badge>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <VinIntelligencePanel items={data.recentVehicles.map((vehicle) => ({ vin: vehicle.vin, mileage: vehicle.mileage, status: vehicle.status }))} />
            <DamageAnalysisPanel items={[
              { id: 'damage-1', title: 'Front bumper impact', severity: 'Medium', estimate: 1800, confidence: 0.84 },
              { id: 'damage-2', title: 'Rear quarter panel', severity: 'High', estimate: 3200, confidence: 0.79 }
            ]} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AuctionCalculatorPanel items={[
              {
                id: 'lane-1',
                title: '2020 Civic EX',
                purchasePrice: 9000,
                repairEstimate: 1800,
                transportCost: 450,
                auctionFees: 600,
                expectedRetailPrice: 14500,
                demandScore: 0.8
              },
              {
                id: 'lane-2',
                title: '2018 Corolla LE',
                purchasePrice: 7200,
                repairEstimate: 1400,
                transportCost: 400,
                auctionFees: 550,
                expectedRetailPrice: 11800,
                demandScore: 0.65
              }
            ]} />
            <RepairEstimatorPanel items={[
              {
                id: 'repair-1',
                title: 'Front bumper impact',
                laborHours: 6,
                materialCost: 850,
                paintCost: 450,
                urgency: 'Medium'
              },
              {
                id: 'repair-2',
                title: 'Rear quarter panel',
                laborHours: 8,
                materialCost: 1200,
                paintCost: 700,
                urgency: 'High'
              }
            ]} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PricingSummaryPanel items={[
              {
                title: '2020 Civic EX',
                retailPrice: 14500,
                repairCost: 1800,
                transportCost: 450,
                fees: 600
              },
              {
                title: '2018 Corolla LE',
                retailPrice: 11800,
                repairCost: 1400,
                transportCost: 400,
                fees: 550
              }
            ]} />
            <ReconditioningChecklistPanel items={[
              { id: 'task-1', title: 'Detail vehicle', completed: true },
              { id: 'task-2', title: 'Replace tires', completed: false },
              { id: 'task-3', title: 'Photograph unit', completed: false }
            ]} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="text-sm font-semibold text-neutral-700">AI opportunity watchlist</div>
              <div className="mt-3 space-y-2">
                {data.opportunities.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{item.vin}</div>
                      <div className="text-sm font-semibold text-primary">{item.score}/100</div>
                    </div>
                    <div className="mt-1 text-sm text-neutral-600">{item.summary}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-500">{item.label} • {item.recommendation ?? 'No recommendation'}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="text-sm font-semibold text-neutral-700">Workflow summary</div>
              <div className="mt-3 space-y-2 text-sm text-neutral-700">
                <div className="font-medium">{workflowSummary.total} records across {workflowSummary.stageCount} stages</div>
                <ul className="space-y-1">
                  {workflowSummary.activeStates.map((item) => (
                    <li key={item.state} className="flex items-center justify-between rounded-lg border border-border px-2 py-1">
                      <span>{item.state}</span>
                      <span className="text-neutral-500">{item.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
            <Card>
              <div className="text-sm font-semibold text-neutral-700">Recent activity</div>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                {data.activity.map((item) => (
                  <li key={item.id} className="rounded-lg border border-border p-2">
                    {item.summary} <span className="text-neutral-500">({item.type})</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <DealerWorkspaceClient
            vehicles={data.recentVehicles}
            analyses={data.analyses.map((item) => ({
              id: item.id,
              vehicleId: item.vehicleId,
              recommendation: item.recommendation,
              workflowState: item.workflowState,
              projectedRoi: item.projectedRoi ? Number(item.projectedRoi) : null,
              vehicle: { vin: item.vehicle.vin }
            }))}
            activity={data.activity.map((item) => ({ id: item.id, summary: item.summary, type: item.type }))}
          />
        </div>
      </DashboardShell>
    );
  } catch {
    return (
      <DashboardShell title="Dealer Workspace" subtitle="Acquisition pipeline, VIN analysis, sourcing, and profit view.">
        <DealerWorkspaceClient vehicles={[]} analyses={[]} activity={[]} loaderError />
      </DashboardShell>
    );
  }
}
