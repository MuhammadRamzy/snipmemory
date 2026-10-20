import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { PlanCards } from '../../components/PlanCards';
import { Alert, Badge, Button, Card, CardHeader, ErrorText, PageHeader, PageLoader, Tabs } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { date, money } from '../../lib/format';
import { useSalon } from '../../lib/salon';
import type { PricedPlan } from '../../lib/types';
import { useApi } from '../../lib/useApi';

interface BillingData {
  provider: 'stripe' | 'dev' | 'none';
  plans: PricedPlan[];
  packs: { id: string; credits: number; amount: number; currency: string }[];
  payments: { id: string; amount: number; currency: string; status: string; description: string; invoiceUrl: string | null; createdAt: number }[];
}

export default function Billing() {
  const { base, salon, plan, reload: reloadSalon, viewer } = useSalon();
  const { data, error, reload } = useApi<BillingData>(`${base}/billing`);
  const [interval, setInterval] = useState<'month' | 'year'>(salon.billingInterval);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [params] = useSearchParams();

  if (error) return <ErrorText error={error} />;
  if (!data) return <PageLoader />;

  const go = async (key: string, fn: () => Promise<{ url?: string; activated?: boolean; scheduled?: boolean }>) => {
    setBusy(key);
    setActionError(null);
    try {
      const res = await fn();
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      await Promise.all([reload(), reloadSalon()]);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const statusLabel =
    salon.subscriptionStatus === 'trialing'
      ? `Free trial of ${plan.name} until ${date(salon.trialEndsAt)}`
      : salon.subscriptionStatus === 'past_due'
        ? 'Payment failed — please update your card'
        : plan.id === 'free'
          ? 'Free plan'
          : `${plan.name} · renews ${date(salon.currentPeriodEnd)}`;

  return (
    <div className="animate-in space-y-6">
      <PageHeader
        title="Billing"
        description={statusLabel}
        action={
          salon.hasBillingAccount &&
          data.provider === 'stripe' && (
            <Button variant="secondary" loading={busy === 'portal'} onClick={() => go('portal', () => api.post(`${base}/billing/portal`))}>
              Manage payment method & invoices
            </Button>
          )
        }
      />
      {params.get('checkout') === 'success' && <Alert tone="success" title="Payment received">Thanks! Your plan updates within a few seconds.</Alert>}
      {data.provider === 'dev' && <Alert tone="warning" title="Test mode">Stripe isn't configured, so upgrades activate instantly without payment.</Alert>}
      {viewer.impersonating && <Alert tone="danger">Support sessions can't start checkouts.</Alert>}
      {actionError && <ErrorText error={actionError} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Plans</h2>
        <Tabs value={interval} onChange={setInterval} options={[{ value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly · 2 months free' }]} />
      </div>
      <PlanCards
        plans={data.plans}
        interval={interval}
        currentPlanId={salon.subscriptionStatus === 'trialing' ? undefined : plan.id}
        renderAction={(p) => {
          const current = p.id === plan.id && salon.subscriptionStatus !== 'trialing' && (p.id === 'free' || salon.billingInterval === interval);
          if (current) return <Button variant="secondary" disabled>Current plan</Button>;
          if (p.id === 'free') {
            return (
              <Button
                variant="ghost"
                loading={busy === 'free'}
                onClick={() => window.confirm('Switch to Free? Automated reminders stop and new clients are capped at 75. Your data is kept.') && go('free', () => api.post(`${base}/billing/downgrade`))}
              >
                Switch to Free
              </Button>
            );
          }
          return (
            <Button variant={p.id === 'studio' ? 'accent' : 'primary'} loading={busy === p.id} onClick={() => go(p.id, () => api.post(`${base}/billing/checkout`, { planId: p.id, interval }))}>
              {salon.subscriptionStatus === 'trialing' && p.id === plan.id ? 'Keep Studio' : `Choose ${p.name}`}
            </Button>
          );
        }}
      />

      <Card>
        <CardHeader title="Reminder credits" description={`${salon.messageCredits} monthly + ${salon.bonusCredits} purchased. One credit = one automated WhatsApp or SMS. Purchased credits never expire.`} />
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {data.packs.map((pack) => (
            <div key={pack.id} className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-semibold">{pack.credits.toLocaleString()} credits</p>
                <p className="text-sm text-muted">{money(pack.amount, pack.currency)}</p>
              </div>
              <Button size="sm" loading={busy === pack.id} onClick={() => go(pack.id, () => api.post(`${base}/billing/credits`, { packId: pack.id }))}>
                Buy
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Payment history" />
        {data.payments.length === 0 ? (
          <p className="p-5 text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="w-28 text-muted">{date(p.createdAt)}</span>
                <span className="flex-1">{p.description}</span>
                <span className="font-semibold tabular-nums">{money(p.amount, p.currency)}</span>
                <Badge tone={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : 'neutral'}>{p.status}</Badge>
                {p.invoiceUrl && (
                  <a href={p.invoiceUrl} target="_blank" rel="noreferrer" className="text-accent">
                    Invoice
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
