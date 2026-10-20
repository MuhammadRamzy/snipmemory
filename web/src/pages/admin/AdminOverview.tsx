import { Link } from 'react-router';
import { Card, CardHeader, ErrorText, PageHeader, PageLoader, Stat } from '../../components/ui';
import { bytes, money } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface Metrics {
  salons: { trialing: number; paid: number; free: number; pastDue: number; total: number };
  mrr: { currency: string; amount: number; salons: number }[];
  mrrUsdApprox: number;
  arrUsdApprox: number;
  signups30d: number;
  signups7d: number;
  trialsExpired30d: number;
  churned30d: number;
  visits30d: number;
  clients: number;
  photos: { count: number; bytes: number };
  messages30d: { kind: string; status: string; n: number; credits: number | null }[];
  recoveredVisits30d: number;
  signupSeries: { date: string; signups: number }[];
  topSalons: { id: string; name: string; visits: number }[];
}

export default function AdminOverview() {
  const { data, error } = useApi<Metrics>('/api/admin/metrics');
  if (error) return <ErrorText error={error} />;
  if (!data) return <PageLoader />;
  const sent = (kind: string) => data.messages30d.filter((m) => m.kind === kind && m.status === 'sent').reduce((s, m) => s + m.n, 0);
  const failed = data.messages30d.filter((m) => m.status === 'failed').reduce((s, m) => s + m.n, 0);
  const conversion = data.trialsExpired30d + data.salons.paid ? Math.round((data.salons.paid / (data.salons.paid + data.trialsExpired30d + data.salons.trialing)) * 100) : 0;
  const max = Math.max(1, ...data.signupSeries.map((s) => s.signups));
  // ~$0.015/GB-month on R2 — storage is not a meaningful cost driver.
  const storageCost = (data.photos.bytes / 1024 ** 3) * 0.015;

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="Live numbers across every salon." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="MRR (approx. USD)" value={money(data.mrrUsdApprox, 'USD')} hint={`ARR ≈ ${money(data.arrUsdApprox, 'USD')}`} tone="success" />
        <Stat label="Paying salons" value={data.salons.paid} hint={`${data.salons.pastDue} past due`} />
        <Stat label="In trial" value={data.salons.trialing} hint={`${data.signups7d} signups this week`} />
        <Stat label="Free plan" value={data.salons.free} hint={`${data.salons.total} salons total`} />
        <Stat label="Signups · 30d" value={data.signups30d} />
        <Stat label="Paid share of trials (approx.)" value={`${conversion}%`} hint={`${data.trialsExpired30d} trials expired to Free · 30d`} />
        <Stat label="Churned · 30d" value={data.churned30d} />
        <Stat label="Visits brought back · 30d" value={data.recoveredVisits30d} tone="accent" hint="Product value delivered" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Signups" description="Last 30 days" />
          <div className="flex h-36 items-end gap-1 p-5">
            {data.signupSeries.map((s) => (
              <div key={s.date} title={`${s.date}: ${s.signups}`} className="flex-1 rounded-t bg-accent/80" style={{ height: `${Math.max(4, (s.signups / max) * 100)}%`, opacity: s.signups ? 1 : 0.25 }} />
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="MRR by currency" />
          <ul className="divide-y divide-border text-sm">
            {data.mrr.length === 0 && <li className="px-5 py-3 text-muted">No paying salons yet.</li>}
            {data.mrr.map((m) => (
              <li key={m.currency} className="flex justify-between px-5 py-3">
                <span className="text-muted">
                  {m.currency} · {m.salons} salons
                </span>
                <span className="font-semibold tabular-nums">{money(m.amount, m.currency)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Usage · 30 days" />
          <dl className="divide-y divide-border text-sm">
            {[
              ['Visits recorded', data.visits30d.toLocaleString()],
              ['Clients on platform', data.clients.toLocaleString()],
              ['Reminders sent', sent('reminder').toLocaleString()],
              ['OTP codes sent', sent('otp').toLocaleString()],
              ['Failed messages', failed.toLocaleString()],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between px-5 py-3">
                <dt className="text-muted">{k}</dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="R2 media vault" />
          <dl className="divide-y divide-border text-sm">
            <div className="flex justify-between px-5 py-3">
              <dt className="text-muted">Photos</dt>
              <dd className="font-semibold">{data.photos.count.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between px-5 py-3">
              <dt className="text-muted">Stored</dt>
              <dd className="font-semibold">{bytes(data.photos.bytes)}</dd>
            </div>
            <div className="flex justify-between px-5 py-3">
              <dt className="text-muted">Est. storage cost</dt>
              <dd className="font-semibold">${storageCost.toFixed(2)}/mo</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Most active salons" />
          <ul className="divide-y divide-border text-sm">
            {data.topSalons.map((s) => (
              <li key={s.id}>
                <Link to={`/admin/salons/${s.id}`} className="flex justify-between px-5 py-3 hover:bg-surface-2">
                  <span className="truncate">{s.name}</span>
                  <span className="tabular-nums text-muted">{s.visits} visits</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
