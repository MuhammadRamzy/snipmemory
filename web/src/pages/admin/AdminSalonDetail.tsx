import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge, Button, Card, CardHeader, ErrorText, Input, PageHeader, PageLoader, Select } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { bytes, date, dateTime, money } from '../../lib/format';
import type { Member, Plan, Salon } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { statusBadge } from './AdminSalons';

interface Detail {
  salon: Salon;
  plan: Plan;
  members: Member[];
  payments: { id: string; amount: number; currency: string; status: string; description: string; provider: string; createdAt: number }[];
  audit: { id: string; action: string; meta: string; impersonatorId: string | null; createdAt: number }[];
  stats: { clients: number; visits30: number; photos: number; bytes: number; messages30: number };
}

export default function AdminSalonDetail() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { data, error, reload } = useApi<Detail>(`/api/admin/salons/${salonId}`);
  const plans = useApi<{ plans: Plan[] }>('/api/admin/plans');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [credits, setCredits] = useState('250');
  const [reason, setReason] = useState('');
  const [payment, setPayment] = useState({ amount: '', description: '' });

  if (error) return <ErrorText error={error} />;
  if (!data) return <PageLoader />;
  const { salon, stats } = data;

  const patch = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setActionError(null);
    try {
      await api.patch(`/api/admin/salons/${salon.id}`, body);
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const impersonate = async () => {
    const why = reason.trim() || window.prompt('Reason for accessing this salon (recorded in the audit log):') || '';
    if (why.trim().length < 5) return setActionError('Give a reason of at least 5 characters.');
    setBusy('imp');
    try {
      await api.post(`/api/admin/salons/${salon.id}/impersonate`, { reason: why });
      await refresh();
      navigate('/app');
    } catch (err) {
      setActionError(errorMessage(err));
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back="/admin/salons"
        title={
          <span className="flex items-center gap-3">
            {salon.name} {statusBadge(salon)}
          </span>
        }
        description={`${salon.slug} · ${[salon.city, salon.country].filter(Boolean).join(', ')} · ${salon.currency} · signed up ${date(salon.createdAt)}`}
        action={
          <Button variant="danger" onClick={impersonate} loading={busy === 'imp'}>
            Open as support
          </Button>
        }
      />
      {actionError && <ErrorText error={actionError} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Clients', stats.clients],
          ['Visits · 30d', stats.visits30],
          ['Photos', stats.photos],
          ['Storage', bytes(stats.bytes)],
          ['Messages · 30d', stats.messages30],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{k}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{v}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Subscription" description={`${data.plan.name} · ${salon.subscriptionStatus}${salon.trialEndsAt ? ` · trial ends ${date(salon.trialEndsAt)}` : ''}`} />
          <div className="space-y-4 p-5">
            <div className="flex gap-2">
              <Select aria-label="Plan" defaultValue={salon.planId} id="plan-select">
                {plans.data?.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Button
                loading={busy === 'plan'}
                onClick={() => patch('plan', { planId: (document.getElementById('plan-select') as HTMLSelectElement).value, subscriptionStatus: 'active' })}
              >
                Set plan
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={busy === 'trial'} onClick={() => patch('trial', { extendTrialDays: 14 })}>
                Extend trial 14 days
              </Button>
              {salon.suspendedAt ? (
                <Button variant="secondary" loading={busy === 'susp'} onClick={() => patch('susp', { suspended: false })}>
                  Lift suspension
                </Button>
              ) : (
                <Button
                  variant="danger-ghost"
                  loading={busy === 'susp'}
                  onClick={() => {
                    const why = window.prompt('Suspension reason shown to the salon:');
                    if (why) void patch('susp', { suspended: true, suspendedReason: why });
                  }}
                >
                  Suspend
                </Button>
              )}
            </div>
            <div className="flex items-end gap-2">
              <Input label={`Bonus credits (now ${salon.bonusCredits}, monthly ${salon.messageCredits})`} type="number" value={credits} onChange={(e) => setCredits(e.target.value)} />
              <Button loading={busy === 'cred'} onClick={() => patch('cred', { addCredits: Number(credits) })}>
                Add
              </Button>
            </div>
            <Input label="Support access reason" placeholder="e.g. Ticket #1234 — reminders not sending" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Team" />
          <ul className="divide-y divide-border text-sm">
            {data.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-3">
                <span>
                  {m.displayName} <span className="text-muted">{m.email ?? ''}</span>
                </span>
                <span className="flex gap-2">
                  <Badge className="capitalize">{m.role}</Badge>
                  {!m.active && <Badge tone="danger">inactive</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Payments" />
          <ul className="divide-y divide-border text-sm">
            {data.payments.length === 0 && <li className="px-5 py-3 text-muted">No payments.</li>}
            {data.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="w-24 text-muted">{date(p.createdAt)}</span>
                <span className="flex-1">{p.description}</span>
                <span className="tabular-nums">{money(p.amount, p.currency)}</span>
                <Badge tone={p.status === 'paid' ? 'success' : 'danger'}>{p.status}</Badge>
                <Badge>{p.provider}</Badge>
              </li>
            ))}
          </ul>
          <form
            className="flex flex-wrap items-end gap-2 border-t border-border p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy('pay');
              try {
                await api.post(`/api/admin/salons/${salon.id}/payments`, { amount: Math.round(Number(payment.amount) * 100), description: payment.description });
                setPayment({ amount: '', description: '' });
                await reload();
              } catch (err) {
                setActionError(errorMessage(err));
              } finally {
                setBusy(null);
              }
            }}
          >
            <Input label={`Amount (${salon.currency})`} className="w-28" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} required />
            <div className="flex-1">
              <Input label="Description" value={payment.description} onChange={(e) => setPayment({ ...payment, description: e.target.value })} required placeholder="Bank transfer — annual Studio" />
            </div>
            <Button type="submit" loading={busy === 'pay'}>
              Record
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Audit log" />
          <ul className="max-h-96 divide-y divide-border overflow-y-auto text-sm">
            {data.audit.map((a) => (
              <li key={a.id} className="px-5 py-2.5">
                <div className="flex justify-between gap-3">
                  <span className="font-mono text-xs">{a.action}</span>
                  <span className="text-xs text-muted">{dateTime(a.createdAt)}</span>
                </div>
                {a.meta !== '{}' && <p className="truncate text-xs text-muted">{a.meta}</p>}
                {a.impersonatorId && <Badge tone="danger">support</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
