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
import { reconditioningService } from '@/lib/vin-intelligence/services/reconditioning-service';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

function toDamageSeverity(repairEstimate: number): 'Low' | 'Medium' | 'High' {
  if (repairEstimate > 2500) return 'High';
  if (repairEstimate > 1000) return 'Medium';
  return 'Low';
}

export default async function DealerPage() {
  const session = await requireSession(['DEALER_OWNER', 'DEALER_BUYER', 'ADMIN']);

  try {
    const data = await loadDealerDashboard(session.organizationId);
    const workflowSummary = summarizeWorkflowStates(data.recentVehicles, data.analyses);

    const analysesWithNumbers = data.analyses.map((item) => ({
      ...item,
      marketValue: item.marketValue ? Number(item.marketValue) : null,
      wholesaleValue: item.wholesaleValue ? Number(item.wholesaleValue) : null,
      retailValue: item.retailValue ? Number(item.retailValue) : null,
      transportEstimate: item.transportEstimate ? Number(item.transportEstimate) : null,
      repairEstimate: item.repairEstimate ? Number(item.repairEstimate) : null,
      feesEstimate: item.feesEstimate ? Number(item.feesEstimate) : null
    }));

    const damageItems = analysesWithNumbers
      .filter((a) => a.repairEstimate != null && a.repairEstimate > 0)
      .map((a) => ({
        id: a.id,
        title: `${a.vehicle.vin} repair estimate`,
        severity: toDamageSeverity(a.repairEstimate!),
        estimate: a.repairEstimate,
        confidence: a.confidenceScore ?? 0.7
      }));

    const auctionItems = analysesWithNumbers
      .filter((a) => a.retailValue != null)
      .map((a) => ({
        id: a.id,
        title: a.vehicle.vin,
        purchasePrice: a.wholesaleValue ?? 0,
        repairEstimate: a.repairEstimate ?? 0,
        transportCost: a.transportEstimate ?? 0,
        auctionFees: a.feesEstimate ?? 0,
        expectedRetailPrice: a.retailValue!,
        demandScore: a.confidenceScore ?? 0.6
      }));

    const repairItems = damageItems.map((item) => ({
      id: item.id,
      title: item.title,
      // Reverse-derived so the panel's internal cost formula (laborHours *
      // rate + materialCost + paintCost) reproduces the real, stored
      // repairEstimate rather than substituting a fake default estimate.
      laborHours: (item.estimate ?? 0) / 95,
      materialCost: 0,
      paintCost: 0,
      urgency: item.severity
    }));

    const pricingItems = analysesWithNumbers
      .filter((a) => a.retailValue != null)
      .map((a) => ({
        title: a.vehicle.vin,
        retailPrice: a.retailValue!,
        repairCost: a.repairEstimate ?? 0,
        transportCost: a.transportEstimate ?? 0,
        fees: a.feesEstimate ?? 0
      }));

    const reconditioningVehicle = data.recentVehicles[0];
    const reconditioningTasks = reconditioningVehicle
      ? reconditioningService.buildPlan({
          mileageMiles: reconditioningVehicle.mileage ?? 0,
          decoded: {
            vin: reconditioningVehicle.vin,
            make: reconditioningVehicle.make,
            model: reconditioningVehicle.model,
            modelYear: reconditioningVehicle.year,
            trim: null, series: null, bodyClass: null, driveType: null, transmissionStyle: null,
            transmissionSpeeds: null, engineCylinders: null, engineDisplacementLiters: null,
            engineHorsepower: null, engineManufacturer: null, fuelTypePrimary: null, doors: null,
            plantCity: null, plantCountry: null, factoryOptions: [], safetyEquipment: [],
            decodeErrorCode: null, decodeErrorText: null, decodeCompletenessPercent: 0, raw: {}
          } satisfies DecodedVehicle,
          riskLevel: 'Low'
        }).value.tasks
      : [];

    return (
      <DashboardShell title="Dealer Workspace" subtitle="Acquisition pipeline, VIN analysis, sourcing, and profit view.">
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
            <Card>
              <div className="text-sm text-neutral-500">Customers</div>
              <div className="mt-2 text-3xl font-bold">{data.customerCount}</div>
            </Card>
            <Card>
              <div className="text-sm text-neutral-500">Deals</div>
              <div className="mt-2 text-3xl font-bold">{data.dealCount}</div>
            </Card>
            <Card>
              <div className="text-sm text-neutral-500">Marketplace posts</div>
              <div className="mt-2 text-3xl font-bold">{data.listingCount}</div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <VinIntelligencePanel items={data.recentVehicles.map((vehicle) => ({ vin: vehicle.vin, mileage: vehicle.mileage, status: vehicle.status }))} />
            <DamageAnalysisPanel items={damageItems} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AuctionCalculatorPanel items={auctionItems} />
            <RepairEstimatorPanel items={repairItems} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PricingSummaryPanel items={pricingItems} />
            <ReconditioningChecklistPanel items={reconditioningTasks} />
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
            <Card>
              <div className="text-sm font-semibold text-neutral-700">Notifications</div>
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                {data.notifications.length === 0 ? (
                  <li className="rounded-lg border border-border p-2 text-neutral-500">No notifications yet.</li>
                ) : data.notifications.map((item) => (
                  <li key={item.id} className="rounded-lg border border-border p-2">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-neutral-600">{item.message}</div>
                    <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">{item.status}</div>
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
