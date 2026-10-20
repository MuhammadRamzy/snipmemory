import { useState } from 'react';
import { Link } from 'react-router';
import { Icons } from '../../components/icons';
import { Alert, Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorText, LinkButton, PageHeader, PageLoader, Tabs } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { dateTime, relative } from '../../lib/format';
import { useSalon } from '../../lib/salon';
import type { Client } from '../../lib/types';
import { useApi } from '../../lib/useApi';

interface DueItem {
  client: Client;
  lastService: string | null;
  message: string;
  whatsappUrl: string;
  autoEligible: boolean;
}

interface RemindersData {
  automated: boolean;
  enabled: boolean;
  credits: { monthly: number; bonus: number };
  due: DueItem[];
  upcoming: Client[];
  history: { id: string; clientId: string; clientName: string; channel: string; status: string; manual: boolean; error: string | null; recovered: boolean; createdAt: number }[];
}

export default function Reminders() {
  const { base, isOwner } = useSalon();
  const { data, error, reload } = useApi<RemindersData>(`${base}/reminders`);
  const [tab, setTab] = useState<'due' | 'upcoming' | 'history'>('due');
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  if (error) return <ErrorText error={error} />;
  if (!data) return <PageLoader />;
  const credits = data.credits.monthly + data.credits.bonus;
  const recovered = data.history.filter((h) => h.recovered).length;

  const act = async (clientId: string, fn: () => Promise<unknown>) => {
    setBusy(clientId);
    setRowError((e) => ({ ...e, [clientId]: '' }));
    try {
      await fn();
      await reload();
    } catch (err) {
      setRowError((e) => ({ ...e, [clientId]: errorMessage(err) }));
    } finally {
      setBusy(null);
    }
  };

  const sendManual = (item: DueItem) => {
    // Open WhatsApp synchronously (popup blockers), then log it.
    window.open(item.whatsappUrl, '_blank', 'noopener');
    void act(item.client.id, () => api.post(`${base}/reminders/${item.client.id}/manual`));
  };

  return (
    <div className="animate-in space-y-6">
      <PageHeader
        title="Reminders"
        description="Clients whose usual return date has passed. A nudge now beats a lost regular."
        action={
          <LinkButton to="/app/settings#reminders" variant="secondary">
            <Icons.settings size={16} /> Message & schedule
          </LinkButton>
        }
      />

      {data.automated ? (
        <Alert
          tone={credits < 20 ? 'warning' : 'accent'}
          title={data.enabled ? `Automatic reminders are on · ${credits.toLocaleString()} credits left` : 'Automatic reminders are paused'}
          action={isOwner && credits < 50 && <Link to="/app/billing" className="font-semibold underline">Top up</Link>}
        >
          {data.enabled
            ? 'Clients who agreed to reminders get a WhatsApp/SMS automatically inside your sending hours. Others can be nudged with one tap below.'
            : 'Turn them on in Settings, or send one-tap WhatsApp reminders below.'}
        </Alert>
      ) : (
        <Alert
          tone="accent"
          title="Send reminders from your own WhatsApp — free"
          action={isOwner && <Link to="/app/billing" className="font-semibold underline">Automate it</Link>}
        >
          Tap WhatsApp to open a ready-written message. Upgrade to have SnipMemory send them for you on schedule.
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'due', label: `Due now (${data.due.length})` },
            { value: 'upcoming', label: `Next 7 days (${data.upcoming.length})` },
            { value: 'history', label: 'Sent' },
          ]}
        />
        {recovered > 0 && <Badge tone="success">{recovered} of the last {data.history.length} reminders brought a client back</Badge>}
      </div>

      {tab === 'due' && (
        <Card>
          {data.due.length === 0 ? (
            <EmptyState icon={<Icons.check />} title="Nobody is overdue">
              When a client passes their usual return date they'll show up here.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {data.due.map((item) => (
                <li key={item.client.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Link to={`/app/clients/${item.client.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={item.client.name} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.client.name}</p>
                      <p className="truncate text-sm text-muted">
                        {item.lastService ?? 'Visit'} {relative(item.client.lastVisitAt)}
                        {item.client.lastRemindedAt ? ` · reminded ${relative(item.client.lastRemindedAt)}` : ''}
                      </p>
                      {rowError[item.client.id] && <p className="text-sm text-danger">{rowError[item.client.id]}</p>}
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => act(item.client.id, () => api.post(`${base}/reminders/${item.client.id}/snooze`, { days: 7 }))} disabled={busy === item.client.id}>
                      Snooze 7d
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => sendManual(item)} disabled={busy === item.client.id}>
                      <Icons.whatsapp size={15} /> WhatsApp
                    </Button>
                    {data.automated && item.autoEligible && (
                      <Button size="sm" variant="accent" loading={busy === item.client.id} onClick={() => act(item.client.id, () => api.post(`${base}/reminders/${item.client.id}/send`))}>
                        <Icons.send size={15} /> Send now
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'upcoming' && (
        <Card>
          {data.upcoming.length === 0 ? (
            <EmptyState icon={<Icons.clock />} title="No reminders due this week" />
          ) : (
            <ul className="divide-y divide-border">
              {data.upcoming.map((c) => (
                <li key={c.id}>
                  <Link to={`/app/clients/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-2">
                    <Avatar name={c.name} size={36} />
                    <span className="flex-1 font-medium">{c.name}</span>
                    <span className="text-sm text-muted">{relative(c.nextReminderAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardHeader title="Recently sent" description="“Came back” means the client visited after this reminder." />
          {data.history.length === 0 ? (
            <EmptyState icon={<Icons.send />} title="No reminders sent yet" />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {data.history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Link to={`/app/clients/${h.clientId}`} className="flex-1 font-medium hover:underline">
                    {h.clientName}
                  </Link>
                  <span className="text-muted">{dateTime(h.createdAt)}</span>
                  <Badge>{h.manual ? 'WhatsApp (you)' : h.channel}</Badge>
                  {h.status !== 'sent' ? <Badge tone="danger" >{h.error ?? h.status}</Badge> : h.recovered ? <Badge tone="success">Came back</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
