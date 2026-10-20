import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icons } from '../../components/icons';
import { Card, CardHeader, LinkButton, PageHeader, PageLoader, Stat, ErrorText } from '../../components/ui';
import { money, plural } from '../../lib/format';
import { useSalon } from '../../lib/salon';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface DashboardData {
  currency: string;
  visitsToday: number;
  visits30d: number;
  visitsPrev30d: number;
  revenue30d: number;
  newClients30d: number;
  totalClients: number;
  activeClients90d: number;
  returningRate30d: number;
  dueReminders: number;
  remindersSent30d: number;
  recoveredVisits30d: number;
  recoveredRevenue30d: number;
  credits: { monthly: number; bonus: number };
  series: { date: string; visits: number }[];
  stylists: { memberId: string; name: string; visits: number; revenue: number }[];
}

function VisitsChart({ series }: { series: DashboardData['series'] }) {
  const max = Math.max(1, ...series.map((s) => s.visits));
  return (
    <div className="flex h-32 items-end gap-[3px]" role="img" aria-label="Visits per day over the last 30 days">
      {series.map((s) => (
        <div key={s.date} className="group relative flex-1">
          <div
            className="w-full rounded-t-[3px] bg-accent/80 transition group-hover:bg-accent"
            style={{ height: `${Math.max(3, (s.visits / max) * 128)}px`, opacity: s.visits ? 1 : 0.25 }}
          />
          <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-on-ink group-hover:block">
            {s.date.slice(5)} · {s.visits}
          </span>
        </div>
      ))}
    </div>
  );
}

function Checklist() {
  const { salon, usage, base, canManage, reload } = useSalon();
  const steps = [
    { done: usage.clients > 0, label: 'Add your first client and capture their cut', to: '/app/clients?new=1' },
    { done: usage.staff > 1, label: 'Add your stylists and give them PINs', to: '/app/team' },
    { done: Boolean(salon.reminderTemplate || salon.bookingUrl), label: 'Personalise your reminder message & booking link', to: '/app/settings' },
  ];
  if (!canManage || salon.onboardedAt || steps.every((s) => s.done)) return null;
  return (
    <Card className="mb-6">
      <CardHeader
        title="Get set up in 5 minutes"
        description="Salons that finish setup recover their first lapsed client within 3 weeks."
        action={
          <button
            className="text-sm text-muted hover:text-text"
            onClick={async () => {
              await api.post(`${base}/onboarded`);
              await reload();
            }}
          >
            Dismiss
          </button>
        }
      />
      <ul className="divide-y divide-border">
        {steps.map((step) => (
          <li key={step.label}>
            <Link to={step.to} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2">
              <span className={`grid size-6 place-items-center rounded-full border ${step.done ? 'border-success bg-success text-white' : 'border-border text-transparent'}`}>
                <Icons.check size={14} strokeWidth={3} />
              </span>
              <span className={step.done ? 'text-muted line-through' : 'font-medium'}>{step.label}</span>
              <Icons.chevronRight size={16} className="ml-auto text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Dashboard() {
  const { base, salon, canManage, isStation } = useSalon();
  const { me, station } = useAuth();
  const { data, error } = useApi<DashboardData>(`${base}/dashboard`);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const name = isStation ? station?.acting?.displayName : me?.user?.name;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="animate-in">
      <PageHeader
        title={`${greeting}${name ? `, ${name.split(' ')[0]}` : ''}`}
        description={salon.name}
        action={
          <LinkButton to="/app/clients?new=1" variant="accent">
            <Icons.plus size={18} /> New client
          </LinkButton>
        }
      />

      <form
        className="relative mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/app/clients?q=${encodeURIComponent(q)}`);
        }}
      >
        <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Who's in the chair? Search name or phone…"
          className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-4 text-base shadow-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
          autoFocus={isStation}
        />
      </form>

      <Checklist />
      <ErrorText error={error} />
      {!data ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          {data.dueReminders > 0 && (
            <Link to="/app/reminders" className="flex items-center justify-between gap-4 rounded-2xl bg-accent px-5 py-4 text-white transition hover:opacity-95">
              <span>
                <span className="block font-semibold">{plural(data.dueReminders, 'client is', 'clients are')} due for a cut</span>
                <span className="text-sm text-white/80">Send them a reminder before they book somewhere else.</span>
              </span>
              <Icons.chevronRight />
            </Link>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Visits today" value={data.visitsToday} />
            <Stat
              label="Visits · 30 days"
              value={data.visits30d}
              hint={data.visitsPrev30d ? `${data.visits30d >= data.visitsPrev30d ? '▲' : '▼'} vs ${data.visitsPrev30d} previous` : undefined}
            />
            <Stat label="Returning clients" value={`${data.returningRate30d}%`} hint="of visits in 30 days" />
            <Stat
              label="Brought back by reminders"
              value={data.recoveredVisits30d}
              tone="success"
              hint={data.recoveredRevenue30d ? `${money(data.recoveredRevenue30d, data.currency)} recovered` : `${data.remindersSent30d} reminders sent`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Visits" description="Last 30 days" />
              <div className="p-5 pt-10">
                <VisitsChart series={data.series} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Client base" />
              <dl className="divide-y divide-border text-sm">
                {[
                  ['Total clients', data.totalClients.toLocaleString()],
                  ['Active (90 days)', data.activeClients90d.toLocaleString()],
                  ['New this month', data.newClients30d.toLocaleString()],
                  canManage ? ['Revenue logged (30d)', money(data.revenue30d, data.currency)] : null,
                  ['Reminder credits', (data.credits.monthly + data.credits.bonus).toLocaleString()],
                ]
                  .filter((row): row is string[] => Boolean(row))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between px-5 py-3">
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
              </dl>
            </Card>
          </div>

          {canManage && data.stylists.length > 0 && (
            <Card>
              <CardHeader title="Team this month" />
              <div className="divide-y divide-border">
                {data.stylists.map((s) => (
                  <div key={s.memberId} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="font-medium">{s.name}</span>
                    <span className="tabular-nums text-muted">
                      {plural(s.visits, 'visit')} · {money(s.revenue, data.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
