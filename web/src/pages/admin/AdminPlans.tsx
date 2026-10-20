import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardHeader, ErrorText, Input, PageHeader, PageLoader, Textarea, Toggle } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import type { Capability, Plan } from '../../lib/types';
import { useApi } from '../../lib/useApi';

type AdminPlan = Plan & { isPublic: boolean; prices: { currency: string; interval: 'month' | 'year'; amount: number; stripePriceId: string | null }[] };

const CAPABILITIES: { id: Capability; label: string }[] = [
  { id: 'automated_reminders', label: 'Automated reminders' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'station_mode', label: 'Station mode' },
  { id: 'passport_import', label: 'Passport import' },
  { id: 'export', label: 'CSV export' },
  { id: 'branding', label: 'Branding' },
  { id: 'priority_support', label: 'Priority support' },
];

function PlanEditor({ plan, onSaved }: { plan: AdminPlan; onSaved: () => void }) {
  const [form, setForm] = useState(plan);
  const [prices, setPrices] = useState(plan.prices.map((p) => `${p.currency} ${p.interval} ${(p.amount / 100).toFixed(2)}${p.stripePriceId ? ` ${p.stripePriceId}` : ''}`).join('\n'));
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(plan), [plan]);

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const parsed = prices
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [currency, interval, amount, stripePriceId] = line.split(/\s+/);
          if (!currency || (interval !== 'month' && interval !== 'year') || !Number.isFinite(Number(amount))) throw new Error(`Bad price line: "${line}"`);
          return { currency, interval, amount: Math.round(Number(amount) * 100), stripePriceId: stripePriceId ?? null };
        });
      await api.put(`/api/admin/plans/${plan.id}`, {
        name: form.name,
        tagline: form.tagline,
        maxStaff: Number(form.maxStaff),
        maxClients: Number(form.maxClients),
        monthlyMessageCredits: Number(form.monthlyMessageCredits),
        features: form.features.filter(Boolean),
        capabilities: form.capabilities,
        isPublic: form.isPublic,
        prices: parsed,
      });
      setStatus('Saved');
      onSaved();
    } catch (err) {
      setStatus(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2">{plan.name} <Badge>{plan.id}</Badge></span>} action={<Toggle checked={form.isPublic} onChange={(v) => setForm({ ...form, isPublic: v })} label="Public" />} />
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
        <Input label="Max stylists (-1 = unlimited)" type="number" value={form.maxStaff} onChange={(e) => setForm({ ...form, maxStaff: Number(e.target.value) })} />
        <Input label="Max clients (-1 = unlimited)" type="number" value={form.maxClients} onChange={(e) => setForm({ ...form, maxClients: Number(e.target.value) })} />
        <Input label="Monthly reminder credits" type="number" value={form.monthlyMessageCredits} onChange={(e) => setForm({ ...form, monthlyMessageCredits: Number(e.target.value) })} />
        <div className="space-y-2">
          <p className="text-sm font-medium">Capabilities</p>
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map((c) => {
              const on = form.capabilities.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setForm({ ...form, capabilities: on ? form.capabilities.filter((x) => x !== c.id) : [...form.capabilities, c.id] })}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${on ? 'border-accent bg-accent-soft text-accent-text' : 'border-border text-muted'}`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <Textarea label="Features (one per line)" rows={6} value={form.features.join('\n')} onChange={(e) => setForm({ ...form, features: e.target.value.split('\n') })} />
        <Textarea label="Prices: CURRENCY interval amount [stripe_price_id]" rows={6} value={prices} onChange={(e) => setPrices(e.target.value)} className="font-mono text-sm" />
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-3">
        {status && <span className={`text-sm ${status === 'Saved' ? 'text-success' : 'text-danger'}`}>{status}</span>}
        <Button onClick={save} loading={saving}>
          Save plan
        </Button>
      </div>
    </Card>
  );
}

export default function AdminPlans() {
  const { data, error, reload } = useApi<{ plans: AdminPlan[] }>('/api/admin/plans');
  if (error) return <ErrorText error={error} />;
  if (!data) return <PageLoader />;
  return (
    <div className="space-y-6">
      <PageHeader title="Plans & pricing" description="Changes apply to new checkouts immediately. Existing Stripe subscriptions keep their price until changed in Stripe." />
      {data.plans.map((p) => (
        <PlanEditor key={p.id} plan={p} onSaved={reload} />
      ))}
    </div>
  );
}
