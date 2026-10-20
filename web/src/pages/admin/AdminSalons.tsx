import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Badge, Card, ErrorText, PageHeader, Spinner, Tabs } from '../../components/ui';
import { date, relative } from '../../lib/format';
import type { Salon } from '../../lib/types';
import { useApi } from '../../lib/useApi';

type Row = Salon & { ownerEmail: string | null; clients: number; members: number; lastVisitAt: number | null };
type Status = 'all' | 'trialing' | 'active' | 'past_due' | 'free' | 'suspended';

export function statusBadge(s: Pick<Salon, 'subscriptionStatus' | 'planId' | 'suspendedAt'>) {
  if (s.suspendedAt) return <Badge tone="danger">Suspended</Badge>;
  if (s.subscriptionStatus === 'trialing') return <Badge tone="accent">Trial</Badge>;
  if (s.subscriptionStatus === 'past_due') return <Badge tone="warning">Past due</Badge>;
  if (s.planId === 'free') return <Badge>Free</Badge>;
  return <Badge tone="success">Paid</Badge>;
}

export default function AdminSalons() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<Status>('all');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, loading } = useApi<{ salons: Row[] }>(`/api/admin/salons?q=${encodeURIComponent(debounced)}&status=${status}&limit=100`);

  return (
    <div className="space-y-4">
      <PageHeader title="Salons" />
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, slug, email or city"
          className="h-10 flex-1 rounded-xl border border-border bg-surface px-3 outline-none focus:border-accent"
        />
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'trialing', label: 'Trial' },
            { value: 'active', label: 'Paid' },
            { value: 'past_due', label: 'Past due' },
            { value: 'free', label: 'Free' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
      </div>
      <ErrorText error={error} />
      <Card className="overflow-x-auto">
        {loading && !data ? (
          <div className="grid place-items-center py-12">
            <Spinner />
          </div>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Salon</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Clients</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Last visit</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.salons.map((s) => (
                <tr key={s.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link to={`/admin/salons/${s.id}`} className="font-semibold hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {s.ownerEmail} · {[s.city, s.country].filter(Boolean).join(', ')}
                    </p>
                  </td>
                  <td className="px-4 py-3">{statusBadge(s)}</td>
                  <td className="px-4 py-3 capitalize">{s.planId}</td>
                  <td className="px-4 py-3 tabular-nums">{s.clients}</td>
                  <td className="px-4 py-3 tabular-nums">{s.members}</td>
                  <td className="px-4 py-3 text-muted">{relative(s.lastVisitAt)}</td>
                  <td className="px-4 py-3 text-muted">{date(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
