'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table } from '@/components/ui/table';

type HomeProps = {
  user: { email: string; role: string };
  stats: { vehicles: number; analyzed: number; customers: number; deals: number; listings: number; notifications: number };
  vehicles: Array<{ id: string; vin: string; make: string | null; model: string | null; year: number | null; status: string }>;
  customers: Array<{ id: string; firstName: string; lastName: string; email: string | null; status: string }>;
  deals: Array<{ id: string; stage: string; amount: number | null; customerName: string; vehicleVin: string | null }>;
  notifications: Array<{ id: string; title: string; message: string; status: string }>;
  analytics: { closeRate: number; pipelineValue: number; stageBreakdown: Record<string, number> };
  roleOptions: Array<{ id: string; label: string; role: string }>;
  canManageRoles: boolean;
};

export function DealerHomeDashboard(props: HomeProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [dealQuery, setDealQuery] = useState('');

  const [vehicleForm, setVehicleForm] = useState({ vin: '', make: '', model: '', year: '' });
  const [vinInput, setVinInput] = useState('');
  const [vinResult, setVinResult] = useState<any>(null);
  const [crmForm, setCrmForm] = useState({ firstName: '', lastName: '', email: '' });
  const [dealForm, setDealForm] = useState({ customerId: '', vehicleId: '', amount: '' });
  const [roleChanges, setRoleChanges] = useState<Record<string, string>>({});
  const [pricingOutput, setPricingOutput] = useState<any>(null);

  const filteredVehicles = useMemo(() => {
    const query = vehicleQuery.trim().toLowerCase();
    if (!query) return props.vehicles;
    return props.vehicles.filter((v) => `${v.vin} ${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''} ${v.status}`.toLowerCase().includes(query));
  }, [props.vehicles, vehicleQuery]);

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return props.customers;
    return props.customers.filter((c) => `${c.firstName} ${c.lastName} ${c.email ?? ''} ${c.status}`.toLowerCase().includes(query));
  }, [props.customers, customerQuery]);

  const filteredDeals = useMemo(() => {
    const query = dealQuery.trim().toLowerCase();
    if (!query) return props.deals;
    return props.deals.filter((d) => `${d.id} ${d.customerName} ${d.vehicleVin ?? ''} ${d.stage} ${d.amount ?? ''}`.toLowerCase().includes(query));
  }, [props.deals, dealQuery]);

  const vehicleRows = useMemo(() => filteredVehicles.map((v) => [v.vin, [v.year, v.make, v.model].filter(Boolean).join(' '), v.status]), [filteredVehicles]);
  const customerRows = useMemo(() => filteredCustomers.map((c) => [`${c.firstName} ${c.lastName}`, c.email ?? '-', c.status]), [filteredCustomers]);
  const dealRows = useMemo(() => filteredDeals.map((d) => [d.id.slice(0, 8), d.customerName, d.vehicleVin ?? '-', d.stage, d.amount ?? '-']), [filteredDeals]);

  async function request(url: string, method: string, body?: unknown) {
    setBusy(`${method}:${url}`);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error?.message ?? 'Request failed');
      setMessage('Saved successfully. Refreshing dashboard...');
      window.location.reload();
      return payload.data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed');
      throw error;
    } finally {
      setBusy(null);
    }
  }

  async function decodeVin() {
    setBusy('vin-decode');
    setMessage(null);
    try {
      const res = await fetch('/api/vin-decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin: vinInput })
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'VIN decode failed');
      setVinResult(body.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'VIN decode failed');
    } finally {
      setBusy(null);
    }
  }

  async function fetchPricing(vehicleId: string) {
    setBusy('pricing');
    setMessage(null);
    try {
      const res = await fetch(`/api/pricing-recommendations/${vehicleId}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Pricing lookup failed');
      setPricingOutput(body.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pricing lookup failed');
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await request('/api/auth/logout', 'POST');
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1500px] p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[250px_1fr]">
          <aside className="rounded-2xl border border-border bg-white p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">DealerOS AI</p>
              <h2 className="mt-2 text-xl font-bold">Dealer Dashboard</h2>
              <p className="text-xs text-neutral-500">{props.user.email}</p>
              <p className="text-xs text-neutral-500">Role: {props.user.role}</p>
            </div>
            <nav className="grid gap-1 text-sm">
              {[['Overview', 'overview'], ['Inventory', 'inventory'], ['VIN Decoder', 'vin'], ['CRM', 'crm'], ['Deals', 'deals'], ['Customers', 'customers'], ['Analytics', 'analytics'], ['Settings', 'settings'], ['Authentication', 'auth']].map(([label, id]) => (
                <a key={id} href={`#${id}`} className="rounded-lg px-3 py-2 hover:bg-neutral-100">{label}</a>
              ))}
            </nav>
          </aside>

          <main className="grid gap-4">
            <section id="overview" className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <Card><p className="text-xs text-neutral-500">Vehicles</p><p className="mt-2 text-2xl font-bold">{props.stats.vehicles}</p></Card>
              <Card><p className="text-xs text-neutral-500">Analyzed</p><p className="mt-2 text-2xl font-bold">{props.stats.analyzed}</p></Card>
              <Card><p className="text-xs text-neutral-500">Customers</p><p className="mt-2 text-2xl font-bold">{props.stats.customers}</p></Card>
              <Card><p className="text-xs text-neutral-500">Deals</p><p className="mt-2 text-2xl font-bold">{props.stats.deals}</p></Card>
              <Card><p className="text-xs text-neutral-500">Listings</p><p className="mt-2 text-2xl font-bold">{props.stats.listings}</p></Card>
              <Card><p className="text-xs text-neutral-500">Notifications</p><p className="mt-2 text-2xl font-bold">{props.stats.notifications}</p></Card>
            </section>

            <section id="inventory" className="grid gap-4 xl:grid-cols-[1fr_380px]">
              <Card>
                <h3 className="text-lg font-semibold">Inventory Management</h3>
                <div className="mt-3 grid gap-2">
                  <Input placeholder="Filter inventory by VIN, make, model, or status" value={vehicleQuery} onChange={(e) => setVehicleQuery(e.target.value)} />
                  <p className="text-xs text-neutral-500">Showing {filteredVehicles.length} of {props.vehicles.length} vehicles</p>
                </div>
                <div className="mt-4"><Table headers={['VIN', 'Vehicle', 'Status']} rows={vehicleRows} /></div>
              </Card>
              <Card>
                <h3 className="text-lg font-semibold">Add Vehicle</h3>
                <div className="mt-3 grid gap-3">
                  <Input placeholder="VIN" value={vehicleForm.vin} onChange={(e) => setVehicleForm({ ...vehicleForm, vin: e.target.value })} />
                  <Input placeholder="Make" value={vehicleForm.make} onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })} />
                  <Input placeholder="Model" value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} />
                  <Input placeholder="Year" value={vehicleForm.year} onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })} />
                  <Button disabled={!!busy} onClick={() => request('/api/vehicles', 'POST', { vin: vehicleForm.vin, make: vehicleForm.make || undefined, model: vehicleForm.model || undefined, year: vehicleForm.year ? Number(vehicleForm.year) : undefined })}>{busy ? 'Saving...' : 'Create Vehicle'}</Button>
                </div>
              </Card>
            </section>

            <section id="vin" className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <Card>
                <h3 className="text-lg font-semibold">VIN Decoder + AI Enrichment</h3>
                <div className="mt-3 flex gap-2">
                  <Input placeholder="Enter VIN" value={vinInput} onChange={(e) => setVinInput(e.target.value)} />
                  <Button disabled={busy === 'vin-decode'} onClick={decodeVin}>{busy === 'vin-decode' ? 'Decoding...' : 'Decode'}</Button>
                </div>
                {vinResult ? <pre className="mt-3 overflow-auto rounded-xl bg-neutral-900 p-3 text-xs text-neutral-100">{JSON.stringify(vinResult, null, 2)}</pre> : null}
              </Card>
              <Card>
                <h3 className="text-lg font-semibold">AI Pricing Recommendation</h3>
                <div className="mt-3 grid gap-2">
                  <Select onChange={(e) => e.target.value ? fetchPricing(e.target.value) : null} defaultValue="">
                    <option value="">Select vehicle</option>
                    {props.vehicles.map((v) => <option key={v.id} value={v.id}>{v.vin}</option>)}
                  </Select>
                </div>
                {pricingOutput ? <pre className="mt-3 overflow-auto rounded-xl bg-neutral-900 p-3 text-xs text-neutral-100">{JSON.stringify(pricingOutput, null, 2)}</pre> : null}
              </Card>
            </section>

            <section id="crm" className="grid gap-4 xl:grid-cols-[1fr_380px]">
              <Card>
                <h3 className="text-lg font-semibold">CRM</h3>
                <div className="mt-3 grid gap-2">
                  <Input placeholder="Filter customers by name, email, or status" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
                  <p className="text-xs text-neutral-500">Showing {filteredCustomers.length} of {props.customers.length} customers</p>
                </div>
                <div className="mt-4"><Table headers={['Customer', 'Email', 'Status']} rows={customerRows} /></div>
              </Card>
              <Card>
                <h3 className="text-lg font-semibold">Add Customer</h3>
                <div className="mt-3 grid gap-3">
                  <Input placeholder="First name" value={crmForm.firstName} onChange={(e) => setCrmForm({ ...crmForm, firstName: e.target.value })} />
                  <Input placeholder="Last name" value={crmForm.lastName} onChange={(e) => setCrmForm({ ...crmForm, lastName: e.target.value })} />
                  <Input placeholder="Email" value={crmForm.email} onChange={(e) => setCrmForm({ ...crmForm, email: e.target.value })} />
                  <Button disabled={!!busy} onClick={() => request('/api/customers', 'POST', crmForm)}>{busy ? 'Saving...' : 'Create Customer'}</Button>
                </div>
              </Card>
            </section>

            <section id="deals" className="grid gap-4 xl:grid-cols-[1fr_380px]">
              <Card>
                <h3 className="text-lg font-semibold">Deals Pipeline</h3>
                <div className="mt-3 grid gap-2">
                  <Input placeholder="Filter deals by ID, customer, VIN, stage, or amount" value={dealQuery} onChange={(e) => setDealQuery(e.target.value)} />
                  <p className="text-xs text-neutral-500">Showing {filteredDeals.length} of {props.deals.length} deals</p>
                </div>
                <div className="mt-4"><Table headers={['Deal', 'Customer', 'Vehicle', 'Stage', 'Amount']} rows={dealRows} /></div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {props.deals.map((d) => (
                    <Button key={d.id} className="bg-white text-foreground border border-border" disabled={!!busy} onClick={() => request(`/api/deals/${d.id}/auto-advance`, 'POST')}>Auto-advance {d.id.slice(0, 8)}</Button>
                  ))}
                </div>
              </Card>
              <Card>
                <h3 className="text-lg font-semibold">Create Deal</h3>
                <div className="mt-3 grid gap-3">
                  <Select value={dealForm.customerId} onChange={(e) => setDealForm({ ...dealForm, customerId: e.target.value })}>
                    <option value="">Select customer</option>
                    {props.customers.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                  </Select>
                  <Select value={dealForm.vehicleId} onChange={(e) => setDealForm({ ...dealForm, vehicleId: e.target.value })}>
                    <option value="">Select vehicle</option>
                    {props.vehicles.map((v) => <option key={v.id} value={v.id}>{v.vin}</option>)}
                  </Select>
                  <Input placeholder="Amount" value={dealForm.amount} onChange={(e) => setDealForm({ ...dealForm, amount: e.target.value })} />
                  <Button disabled={!!busy} onClick={() => request('/api/deals', 'POST', { customerId: dealForm.customerId, vehicleId: dealForm.vehicleId || undefined, amount: dealForm.amount ? Number(dealForm.amount) : undefined })}>{busy ? 'Saving...' : 'Create Deal'}</Button>
                </div>
              </Card>
            </section>

            <section id="customers" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h3 className="text-lg font-semibold">Customer Snapshot</h3>
                <p className="mt-2 text-sm text-neutral-600">Active customers: {props.customers.filter((c) => c.status === 'ACTIVE').length}</p>
                <p className="text-sm text-neutral-600">Lead customers: {props.customers.filter((c) => c.status === 'LEAD').length}</p>
              </Card>
              <Card>
                <h3 className="text-lg font-semibold">Notifications</h3>
                <ul className="mt-3 grid gap-2 text-sm">
                  {props.notifications.map((n) => <li key={n.id} className="rounded-lg border border-border p-2"><div className="font-medium">{n.title}</div><div className="text-neutral-600">{n.message}</div></li>)}
                </ul>
              </Card>
            </section>

            <section id="analytics" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h3 className="text-lg font-semibold">Analytics Overview</h3>
                <p className="mt-2 text-sm text-neutral-600">Close rate: {Math.round(props.analytics.closeRate * 100)}%</p>
                <p className="text-sm text-neutral-600">Pipeline value: ${props.analytics.pipelineValue.toLocaleString()}</p>
              </Card>
              <Card>
                <h3 className="text-lg font-semibold">Deal Stage Breakdown</h3>
                <ul className="mt-3 grid gap-2 text-sm">
                  {Object.entries(props.analytics.stageBreakdown).map(([stage, count]) => <li key={stage} className="flex justify-between rounded-lg border border-border px-3 py-2"><span>{stage}</span><span>{count}</span></li>)}
                </ul>
              </Card>
            </section>

            <section id="settings" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h3 className="text-lg font-semibold">Settings</h3>
                <p className="mt-2 text-sm text-neutral-600">DealerOS workspace defaults and integration controls are configured through environment and APIs.</p>
              </Card>
              <Card>
                <h3 className="text-lg font-semibold">Roles & Permissions</h3>
                {!props.canManageRoles ? (
                  <p className="mt-2 text-sm text-neutral-600">You do not have permission to manage roles.</p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {props.roleOptions.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                        <span className="text-sm">{item.label}</span>
                        <Select value={roleChanges[item.id] ?? item.role} onChange={(e) => setRoleChanges({ ...roleChanges, [item.id]: e.target.value })}>
                          {['DEALER_OWNER', 'DEALER_BUYER', 'VENDOR_MANAGER', 'ADMIN'].map((role) => <option key={role} value={role}>{role}</option>)}
                        </Select>
                        <Button className="px-3" disabled={!!busy} onClick={() => request(`/api/roles/${item.id}`, 'PATCH', { role: roleChanges[item.id] ?? item.role })}>Save</Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>

            <section id="auth" className="grid gap-4">
              <Card>
                <h3 className="text-lg font-semibold">Authentication</h3>
                <p className="mt-2 text-sm text-neutral-600">Your session is active. Use logout to clear secure auth cookies and return to sign-in.</p>
                <div className="mt-3">
                  <Button className="bg-red-600" disabled={!!busy} onClick={logout}>Logout</Button>
                </div>
              </Card>
            </section>

            {message ? <p className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-neutral-700">{message}</p> : null}
          </main>
        </div>
      </div>
    </div>
  );
}
