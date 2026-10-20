import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ClientForm } from '../../components/ClientForm';
import { Icons } from '../../components/icons';
import { Avatar, Badge, Button, Card, EmptyState, ErrorText, Modal, PageHeader, Spinner, Tabs } from '../../components/ui';
import { relative } from '../../lib/format';
import { useSalon } from '../../lib/salon';
import type { Client } from '../../lib/types';
import { useApi } from '../../lib/useApi';

type Filter = 'all' | 'due' | 'new' | 'lapsed' | 'regulars';

export default function Clients() {
  const { base, canManage, has } = useSalon();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(q);
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(50);
  const showNew = params.get('new') === '1';

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  const path = `${base}/clients?q=${encodeURIComponent(debounced)}&filter=${filter}&limit=${limit}`;
  const { data, error, loading } = useApi<{ clients: Client[]; hasMore: boolean }>(path);

  const closeNew = () => {
    params.delete('new');
    setParams(params, { replace: true });
  };

  return (
    <div className="animate-in">
      <PageHeader
        title="Clients"
        action={
          <>
            {canManage && has('export') && (
              <a href={`${base}/clients/export/csv`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
                <Icons.download size={16} /> Export
              </a>
            )}
            <Button variant="accent" onClick={() => setParams({ new: '1', q })}>
              <Icons.plus size={18} /> New client
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Icons.search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone"
            className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
            autoFocus
          />
        </div>
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'due', label: 'Due' },
            { value: 'new', label: 'New' },
            { value: 'regulars', label: 'Regulars' },
            { value: 'lapsed', label: 'Lapsed' },
          ]}
        />
      </div>

      <ErrorText error={error} />
      <Card className="overflow-hidden">
        {!data && loading ? (
          <div className="grid place-items-center py-16 text-muted">
            <Spinner />
          </div>
        ) : data?.clients.length ? (
          <ul className="divide-y divide-border">
            {data.clients.map((c) => {
              const due = c.nextReminderAt !== null && c.nextReminderAt <= Date.now() && !c.optedOut;
              return (
                <li key={c.id}>
                  <Link to={`/app/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <Avatar name={c.name} src={c.coverPhotoUrl} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="truncate text-sm text-muted">
                        {c.phone} · {c.visitCount ? `${c.visitCount} visit${c.visitCount === 1 ? '' : 's'}, last ${relative(c.lastVisitAt)}` : 'No visits yet'}
                      </p>
                    </div>
                    {due && <Badge tone="warning">Due</Badge>}
                    <Icons.chevronRight size={18} className="text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<Icons.users />}
            title={debounced ? `No client matches “${debounced}”` : 'No clients yet'}
            action={
              <Button variant="accent" onClick={() => setParams({ new: '1', q: debounced })}>
                <Icons.plus size={18} /> {debounced ? `Add “${debounced}”` : 'Add your first client'}
              </Button>
            }
          >
            Add clients as they sit down — it takes 10 seconds and every future visit is one tap away.
          </EmptyState>
        )}
        {data?.hasMore && (
          <div className="border-t border-border p-3 text-center">
            <Button variant="ghost" onClick={() => setLimit((l) => l + 50)}>
              Show more
            </Button>
          </div>
        )}
      </Card>

      <Modal open={showNew} onClose={closeNew} title="New client">
        <ClientForm
          initialQuery={params.get('q') ?? ''}
          onSaved={(client) => navigate(`/app/clients/${client.id}/visit`)}
          onDuplicate={(client) => navigate(`/app/clients/${client.id}`)}
        />
      </Modal>
    </div>
  );
}
