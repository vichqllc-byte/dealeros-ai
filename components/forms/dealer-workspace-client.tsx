'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { InlineRetry } from '@/components/feedback/inline-retry';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table } from '@/components/ui/table';
import { Toast } from '@/components/ui/toast';
import type { ApiEnvelope } from '@/types/api';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

type VehicleRow = {
  id: string;
  vin: string | null;
  listingUrl?: string | null;
  auctionSource?: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  status: string;
  workflowState: string | null;
  vinAnalyses: Array<{ id: string; recommendation: string | null }>;
};

type VinAnalysisRow = {
  id: string;
  vehicleId: string;
  recommendation: string | null;
  workflowState: string | null;
  projectedRoi: number | null;
  vehicle: { vin: string | null; listingUrl?: string | null };
};

function readCookie(name: string): string | null {
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}

function getVehicleLabel(vehicle: { vin?: string | null; listingUrl?: string | null }) {
  return vehicle.vin ?? vehicle.listingUrl ?? 'Pending auction vehicle';
}

export function DealerWorkspaceClient({
  vehicles,
  analyses,
  activity,
  loaderError = false
}: {
  vehicles: VehicleRow[];
  analyses: VinAnalysisRow[];
  activity: Array<{ id: string; summary: string; type: string }>;
  loaderError?: boolean;
}) {
  const router = useRouter();
  const [vehicleForm, setVehicleForm] = useState({ listingUrl: '', vin: '', year: '', make: '', model: '', workflowState: '' });
  const [vinForm, setVinForm] = useState({ vehicleId: '', marketValue: '', wholesaleValue: '', projectedRoi: '', confidenceScore: '', recommendation: 'NEGOTIATE', workflowState: '' });
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingAnalysisId, setEditingAnalysisId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; description?: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [retryTarget, setRetryTarget] = useState<string | null>(null);
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [analysisQuery, setAnalysisQuery] = useState('');
  const [auctionUrlInput, setAuctionUrlInput] = useState('');
  const [auctionFlowResult, setAuctionFlowResult] = useState<{
    vehicleLabel: string;
    marketValue: number | null;
    repairEstimate: number | null;
    projectedProfit: number | null;
    maximumBid: number | null;
    buyOrPass: 'BUY' | 'PASS';
  } | null>(null);
  const [runningAuctionFlow, setRunningAuctionFlow] = useState(false);
  const controlsDisabled = saving || !!deleting;

  const filteredVehicles = useMemo(() => {
    const query = vehicleQuery.trim().toLowerCase();
    if (!query) return vehicles;
    return vehicles.filter((vehicle) => `${vehicle.vin ?? ''} ${vehicle.listingUrl ?? ''} ${vehicle.auctionSource ?? ''} ${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''} ${vehicle.status} ${vehicle.workflowState ?? ''}`.toLowerCase().includes(query));
  }, [vehicleQuery, vehicles]);

  const filteredAnalyses = useMemo(() => {
    const query = analysisQuery.trim().toLowerCase();
    if (!query) return analyses;
    return analyses.filter((analysis) => `${analysis.vehicle.vin ?? ''} ${analysis.vehicle.listingUrl ?? ''} ${analysis.recommendation ?? ''} ${analysis.workflowState ?? ''} ${analysis.projectedRoi ?? ''}`.toLowerCase().includes(query));
  }, [analysisQuery, analyses]);

  const vehicleRows = useMemo(() => filteredVehicles.map((vehicle) => [getVehicleLabel(vehicle), [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' '), vehicle.status, vehicle.workflowState ?? '—', vehicle.vinAnalyses[0]?.recommendation ?? '—']), [filteredVehicles]);
  const analysisRows = useMemo(() => filteredAnalyses.map((analysis) => [getVehicleLabel(analysis.vehicle), analysis.recommendation ?? '—', analysis.workflowState ?? '—', analysis.projectedRoi ?? '—']), [filteredAnalyses]);

  async function initCsrfToken() {
    try {
      await fetch('/api/auth/csrf', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      });
    } catch {
      return null;
    }

    return readCookie(CSRF_COOKIE);
  }

  async function handleSubmit(url: string, method: string, payload: unknown, successMessage: string) {
    setSaving(true);
    setErrors({});
    setRetryTarget(null);
    try {
      const csrfToken = readCookie(CSRF_COOKIE) ?? (await initCsrfToken());
      if (!csrfToken) {
        setToast({ title: 'Last save failed', description: 'Could not initialize secure session token.' });
        setRetryTarget('mutation');
        return;
      }

      const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: csrfToken },
        body: JSON.stringify(payload)
      });
      const result: ApiEnvelope<unknown> = await response.json();
      if (!result.ok) {
        const details = (result.error.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors || {};
        const nextErrors: Record<string, string> = {};
        Object.entries(details).forEach(([key, values]) => {
          if (values?.[0]) nextErrors[key] = values[0];
        });
        setErrors(nextErrors);
        setToast({ title: result.error.message, description: result.error.code });
        setRetryTarget('mutation');
        return;
      }
      setToast({ title: successMessage });
      router.refresh();
    } catch (error) {
      setToast({ title: 'Request failed', description: error instanceof Error ? error.message : 'Unknown error' });
      setRetryTarget('mutation');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(url: string, successMessage: string) {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    setDeleting(url);
    setRetryTarget(null);
    try {
      const response = await fetch(url, { method: 'DELETE' });
      const result: ApiEnvelope<unknown> = await response.json();
      if (!result.ok) {
        setToast({ title: result.error.message, description: result.error.code });
        setRetryTarget(url);
        return;
      }
      setToast({ title: successMessage });
      router.refresh();
    } catch (error) {
      setToast({ title: 'Delete failed', description: error instanceof Error ? error.message : 'Unknown error' });
      setRetryTarget(url);
    } finally {
      setDeleting(null);
    }
  }

  function formatMoney(value: number | null) {
    if (value == null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }

  async function runAuctionUrlFlow() {
    setRetryTarget(null);
    setErrors({});
    setAuctionFlowResult(null);
    setRunningAuctionFlow(true);

    try {
      const csrfToken = readCookie(CSRF_COOKIE) ?? (await initCsrfToken());
      if (!csrfToken) {
        setToast({ title: 'Last save failed', description: 'Could not initialize secure session token.' });
        setRetryTarget('mutation');
        return;
      }

      const flowResponse = await fetch('/api/vehicles/auction-url/analyze', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: csrfToken },
        body: JSON.stringify({ listingUrl: auctionUrlInput.trim(), mileage: 0 })
      });

      const flowEnvelope: ApiEnvelope<{
        analyzed: boolean;
        reason?: 'VIN_NOT_FOUND';
        usedExistingVehicle: boolean;
        vehicle: { id: string; vin: string | null; listingUrl?: string | null };
        report?: {
          valuation: { value: { value: { marketValue: number } } };
          damage: { value: { totalCost: number } };
          auctionBid: { value: { projectedProfit: number; maxBid: number; recommendation?: 'Proceed' | 'Reconsider' | 'Pause' } };
          recommendation: string;
        };
      }> = await flowResponse.json();

      if (!flowEnvelope.ok) {
        setToast({ title: flowEnvelope.error.message, description: flowEnvelope.error.code });
        setRetryTarget('mutation');
        return;
      }

      const flow = flowEnvelope.data;
      const vehicleLabel = getVehicleLabel(flow.vehicle);

      if (!flow.analyzed || !flow.report) {
        setAuctionFlowResult({
          vehicleLabel,
          marketValue: null,
          repairEstimate: null,
          projectedProfit: null,
          maximumBid: null,
          buyOrPass: 'PASS'
        });
        setToast({ title: 'Vehicle created', description: 'VIN could not be resolved from this URL, so automated analysis is pending.' });
      } else {
        const bidRecommendation = flow.report.auctionBid.value.recommendation;
        const buyOrPass = bidRecommendation === 'Proceed' ? 'BUY' : bidRecommendation === 'Reconsider' || bidRecommendation === 'Pause' ? 'PASS' : flow.report.recommendation === 'PASS' ? 'PASS' : 'BUY';
        setAuctionFlowResult({
          vehicleLabel,
          marketValue: flow.report.valuation.value.value.marketValue,
          repairEstimate: flow.report.damage.value.totalCost,
          projectedProfit: flow.report.auctionBid.value.projectedProfit,
          maximumBid: flow.report.auctionBid.value.maxBid,
          buyOrPass
        });
        setToast({
          title: 'DealerOS completed analysis',
          description: flow.usedExistingVehicle ? `Analyzed existing vehicle ${vehicleLabel}.` : `Vehicle ${vehicleLabel} created and analyzed.`
        });
      }

      router.refresh();
    } catch (error) {
      setToast({ title: 'Request failed', description: error instanceof Error ? error.message : 'Unknown error' });
      setRetryTarget('mutation');
    } finally {
      setRunningAuctionFlow(false);
    }
  }

  if (loaderError) {
    return <InlineRetry title="Dealer workspace data could not be loaded" description="The dashboard data request failed. Retry to reload vehicles, analyses, and activity." onRetry={() => router.refresh()} />;
  }

  return (
    <div className="grid gap-6">
      {toast ? <Toast title={toast.title} description={toast.description} /> : null}
      {retryTarget === 'mutation' ? <InlineRetry title="Last save failed" description="Your changes were not saved. Review the form and retry." onRetry={() => router.refresh()} /> : null}

      <Card>
        <h3 className="text-lg font-semibold">Paste Auction URL</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <Input disabled={controlsDisabled || runningAuctionFlow} placeholder="https://www.iaai.com/... or https://www.copart.com/..." value={auctionUrlInput} onChange={(e) => setAuctionUrlInput(e.target.value)} />
          <Button disabled={controlsDisabled || runningAuctionFlow || !auctionUrlInput.trim()} onClick={runAuctionUrlFlow}>{runningAuctionFlow ? 'DealerOS is working...' : 'DealerOS does everything'}</Button>
        </div>

        {auctionFlowResult ? (
          <div className="mt-5 grid gap-3 rounded-xl border border-border bg-neutral-50 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="sm:col-span-2 lg:col-span-6 text-sm font-medium text-neutral-700">Vehicle appears: {auctionFlowResult.vehicleLabel}</div>
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">Market value</div>
              <div className="mt-1 font-semibold">{formatMoney(auctionFlowResult.marketValue)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">Repair estimate</div>
              <div className="mt-1 font-semibold">{formatMoney(auctionFlowResult.repairEstimate)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">Profit</div>
              <div className="mt-1 font-semibold">{formatMoney(auctionFlowResult.projectedProfit)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">Maximum bid</div>
              <div className="mt-1 font-semibold">{formatMoney(auctionFlowResult.maximumBid)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">Buy / Pass</div>
              <div className="mt-1 font-semibold">{auctionFlowResult.buyOrPass}</div>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="text-lg font-semibold">{editingVehicleId ? 'Edit vehicle' : 'Create vehicle'}</h3>
          {editingVehicleId ? <p className="mt-2 text-xs text-neutral-500">Editing an existing vehicle. Use clear to switch back to create mode.</p> : null}
          <div className="mt-4 grid gap-3">
            <Input disabled={controlsDisabled} placeholder="Auction Listing URL" value={vehicleForm.listingUrl} onChange={(e) => setVehicleForm({ ...vehicleForm, listingUrl: e.target.value })} />
            {errors.listingUrl ? <p className="text-sm text-red-600">{errors.listingUrl}</p> : null}
            <Input disabled={controlsDisabled} placeholder="VIN" value={vehicleForm.vin} onChange={(e) => setVehicleForm({ ...vehicleForm, vin: e.target.value })} />
            {errors.vin ? <p className="text-sm text-red-600">{errors.vin}</p> : null}
            <Input disabled={controlsDisabled} placeholder="Year" value={vehicleForm.year} onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })} />
            <Input disabled={controlsDisabled} placeholder="Make" value={vehicleForm.make} onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })} />
            <Input disabled={controlsDisabled} placeholder="Model" value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} />
            <Input disabled={controlsDisabled} placeholder="Workflow state" value={vehicleForm.workflowState || ''} onChange={(e) => setVehicleForm({ ...vehicleForm, workflowState: e.target.value })} />
            <Button disabled={controlsDisabled} onClick={() => handleSubmit(editingVehicleId ? `/api/vehicles/${editingVehicleId}` : '/api/vehicles', editingVehicleId ? 'PATCH' : 'POST', { listingUrl: vehicleForm.listingUrl || undefined, vin: vehicleForm.vin || undefined, year: vehicleForm.year ? Number(vehicleForm.year) : undefined, make: vehicleForm.make || undefined, model: vehicleForm.model || undefined, workflowState: vehicleForm.workflowState || undefined }, editingVehicleId ? 'Vehicle updated' : 'Vehicle created')}>
              {saving ? 'Saving…' : editingVehicleId ? 'Update vehicle' : 'Create vehicle'}
            </Button>
            {editingVehicleId ? <Button className="bg-white text-foreground border border-border" disabled={controlsDisabled} onClick={() => { setEditingVehicleId(null); setVehicleForm({ listingUrl: '', vin: '', year: '', make: '', model: '', workflowState: '' }); }}>Clear edit</Button> : null}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold">{editingAnalysisId ? 'Edit VIN analysis' : 'Create VIN analysis'}</h3>
          {editingAnalysisId ? <p className="mt-2 text-xs text-neutral-500">Editing an existing analysis. Use clear to switch back to create mode.</p> : null}
          <div className="mt-4 grid gap-3">
            <Input disabled={controlsDisabled} placeholder="Vehicle ID" value={vinForm.vehicleId} onChange={(e) => setVinForm({ ...vinForm, vehicleId: e.target.value })} />
            {errors.vehicleId ? <p className="text-sm text-red-600">{errors.vehicleId}</p> : null}
            <Input disabled={controlsDisabled} placeholder="Market value" value={vinForm.marketValue} onChange={(e) => setVinForm({ ...vinForm, marketValue: e.target.value })} />
            <Input disabled={controlsDisabled} placeholder="Wholesale value" value={vinForm.wholesaleValue} onChange={(e) => setVinForm({ ...vinForm, wholesaleValue: e.target.value })} />
            <Input disabled={controlsDisabled} placeholder="Projected ROI" value={vinForm.projectedRoi} onChange={(e) => setVinForm({ ...vinForm, projectedRoi: e.target.value })} />
            <Input disabled={controlsDisabled} placeholder="Confidence score (0-1)" value={vinForm.confidenceScore} onChange={(e) => setVinForm({ ...vinForm, confidenceScore: e.target.value })} />
            <Input disabled={controlsDisabled} placeholder="Workflow state" value={vinForm.workflowState || ''} onChange={(e) => setVinForm({ ...vinForm, workflowState: e.target.value })} />
            <Button disabled={controlsDisabled} onClick={() => handleSubmit(editingAnalysisId ? `/api/vin-analyses/${editingAnalysisId}` : '/api/vin-analyses', editingAnalysisId ? 'PATCH' : 'POST', { vehicleId: vinForm.vehicleId, decodedPayload: { source: 'manual-form' }, marketValue: vinForm.marketValue ? Number(vinForm.marketValue) : undefined, wholesaleValue: vinForm.wholesaleValue ? Number(vinForm.wholesaleValue) : undefined, projectedRoi: vinForm.projectedRoi ? Number(vinForm.projectedRoi) : undefined, confidenceScore: vinForm.confidenceScore ? Number(vinForm.confidenceScore) : undefined, recommendation: vinForm.recommendation, workflowState: vinForm.workflowState || undefined }, editingAnalysisId ? 'VIN analysis updated' : 'VIN analysis created')}>
              {saving ? 'Saving…' : editingAnalysisId ? 'Update VIN analysis' : 'Create VIN analysis'}
            </Button>
            {editingAnalysisId ? <Button className="bg-white text-foreground border border-border" disabled={controlsDisabled} onClick={() => { setEditingAnalysisId(null); setVinForm({ vehicleId: '', marketValue: '', wholesaleValue: '', projectedRoi: '', confidenceScore: '', recommendation: 'NEGOTIATE', workflowState: '' }); }}>Clear edit</Button> : null}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold">Vehicles</h3>
        <div className="mt-3 grid gap-2">
          <Input disabled={controlsDisabled} placeholder="Filter vehicles by VIN, listing URL, source, make, model, status, or workflow" value={vehicleQuery} onChange={(e) => setVehicleQuery(e.target.value)} />
          <p className="text-xs text-neutral-500">Showing {filteredVehicles.length} of {vehicles.length} vehicles</p>
        </div>
        {vehicles.length === 0 ? <p className="mt-3 text-sm text-neutral-600">No vehicles yet. Create your first acquisition record to begin.</p> : (
          <div className="mt-4 space-y-3">
            <Table headers={['VIN', 'Vehicle', 'Status', 'Workflow', 'Recommendation']} rows={vehicleRows} />
            <div className="flex flex-wrap gap-2">
              {filteredVehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex gap-2">
                  <Button className="bg-white text-foreground border border-border" disabled={controlsDisabled} onClick={() => { setEditingVehicleId(vehicle.id); setVehicleForm({ listingUrl: vehicle.listingUrl || '', vin: vehicle.vin || '', year: vehicle.year?.toString() || '', make: vehicle.make || '', model: vehicle.model || '', workflowState: vehicle.workflowState || '' }); }}>Edit {getVehicleLabel(vehicle)}</Button>
                  <Button className="bg-red-600" disabled={controlsDisabled || deleting === `/api/vehicles/${vehicle.id}`} onClick={() => handleDelete(`/api/vehicles/${vehicle.id}`, 'Vehicle deleted')}>
                    {deleting === `/api/vehicles/${vehicle.id}` ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              ))}
            </div>
            {retryTarget && retryTarget.startsWith('/api/vehicles/') ? <InlineRetry title="Vehicle delete failed" description="The vehicle was not deleted. Retry the delete request." onRetry={() => handleDelete(retryTarget, 'Vehicle deleted')} /> : null}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold">VIN analyses</h3>
        <div className="mt-3 grid gap-2">
          <Input disabled={controlsDisabled} placeholder="Filter analyses by VIN, recommendation, workflow, or ROI" value={analysisQuery} onChange={(e) => setAnalysisQuery(e.target.value)} />
          <p className="text-xs text-neutral-500">Showing {filteredAnalyses.length} of {analyses.length} analyses</p>
        </div>
        {analyses.length === 0 ? <p className="mt-3 text-sm text-neutral-600">No VIN analyses yet. Analyze a vehicle to create the first recommendation.</p> : (
          <div className="mt-4 space-y-3">
            <Table headers={['Vehicle', 'Recommendation', 'Workflow', 'Projected ROI']} rows={analysisRows} />
            <div className="flex flex-wrap gap-2">
              {filteredAnalyses.map((analysis) => (
                <div key={analysis.id} className="flex gap-2">
                  <Button className="bg-white text-foreground border border-border" disabled={controlsDisabled} onClick={() => { setEditingAnalysisId(analysis.id); setVinForm({ vehicleId: analysis.vehicleId, marketValue: '', wholesaleValue: '', projectedRoi: analysis.projectedRoi?.toString() || '', confidenceScore: '', recommendation: analysis.recommendation || 'NEGOTIATE', workflowState: analysis.workflowState || '' }); }}>Edit analysis {getVehicleLabel(analysis.vehicle)}</Button>
                  <Button className="bg-red-600" disabled={controlsDisabled || deleting === `/api/vin-analyses/${analysis.id}`} onClick={() => handleDelete(`/api/vin-analyses/${analysis.id}`, 'VIN analysis deleted')}>
                    {deleting === `/api/vin-analyses/${analysis.id}` ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              ))}
            </div>
            {retryTarget && retryTarget.startsWith('/api/vin-analyses/') ? <InlineRetry title="VIN analysis delete failed" description="The VIN analysis was not deleted. Retry the delete request." onRetry={() => handleDelete(retryTarget, 'VIN analysis deleted')} /> : null}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold">Activity</h3>
        {activity.length === 0 ? <p className="mt-3 text-sm text-neutral-600">No activity yet. Actions taken in this workspace will appear here.</p> : (
          <ul className="mt-4 space-y-2 text-sm text-neutral-700">
            {activity.map((item) => <li key={item.id}>{item.summary} <span className="text-neutral-400">({item.type})</span></li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
