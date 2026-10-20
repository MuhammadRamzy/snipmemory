import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Badge, Button, Card, CardHeader, Input, PageHeader, Select, Tabs } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';

function Announcements() {
  const { data, reload } = useApi<{ announcements: { id: string; message: string; level: string; active: number; expiresAt: number | null; createdAt: number }[] }>('/api/admin/announcements');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState('info');
  const [hours, setHours] = useState('48');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/announcements', { message, level, expiresInHours: hours ? Number(hours) : undefined });
      setMessage('');
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <Card>
      <CardHeader title="In-app announcements" description="Shown at the top of every salon's app." />
      <form onSubmit={submit} className="grid gap-3 border-b border-border p-5 md:grid-cols-[1fr_8rem_8rem_auto] md:items-end">
        <Input label="Message" value={message} onChange={(e) => setMessage(e.target.value)} required />
        <Select label="Level" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </Select>
        <Input label="Expires (hours)" type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
        <Button type="submit">Publish</Button>
        {error && <p className="text-sm text-danger md:col-span-4">{error}</p>}
      </form>
      <ul className="divide-y divide-border text-sm">
        {data?.announcements.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-5 py-3">
            <Badge tone={a.level === 'critical' ? 'danger' : a.level === 'warning' ? 'warning' : 'accent'}>{a.level}</Badge>
            <span className="flex-1">{a.message}</span>
            <span className="text-xs text-muted">{a.expiresAt ? `until ${dateTime(a.expiresAt)}` : 'no expiry'}</span>
            <Button size="sm" variant="secondary" onClick={async () => { await api.patch(`/api/admin/announcements/${a.id}`, { active: !a.active }); await reload(); }}>
              {a.active ? 'Hide' : 'Show'}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Messages() {
  const [status, setStatus] = useState<'all' | 'failed'>('all');
  const { data } = useApi<{ messages: { id: string; salonId: string | null; salonName: string | null; channel: string; kind: string; status: string; provider: string; error: string | null; toPhone: string; createdAt: number }[] }>(
    `/api/admin/messages${status === 'failed' ? '?status=failed' : ''}`,
  );
  return (
    <Card className="overflow-x-auto">
      <CardHeader title="Message delivery" action={<Tabs value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'failed', label: 'Failed' }]} />} />
      <table className="w-full min-w-[700px] text-left text-sm">
        <tbody className="divide-y divide-border">
          {data?.messages.map((m) => (
            <tr key={m.id}>
              <td className="px-5 py-2.5 text-muted">{dateTime(m.createdAt)}</td>
              <td className="px-3 py-2.5">{m.salonId ? <Link to={`/admin/salons/${m.salonId}`} className="hover:underline">{m.salonName}</Link> : '—'}</td>
              <td className="px-3 py-2.5">{m.kind}</td>
              <td className="px-3 py-2.5">{m.channel} · {m.provider}</td>
              <td className="px-3 py-2.5 font-mono text-xs">{m.toPhone}</td>
              <td className="px-3 py-2.5">
                <Badge tone={m.status === 'sent' ? 'success' : 'danger'}>{m.status}</Badge> <span className="text-xs text-danger">{m.error}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Audit() {
  const { data } = useApi<{ entries: { id: string; salonId: string | null; salonName: string | null; action: string; actorEmail: string | null; impersonatorId: string | null; ip: string | null; createdAt: number }[] }>('/api/admin/audit');
  return (
    <Card className="overflow-x-auto">
      <CardHeader title="Audit log" description="Security-relevant actions across the platform." />
      <table className="w-full min-w-[700px] text-left text-sm">
        <tbody className="divide-y divide-border">
          {data?.entries.map((e) => (
            <tr key={e.id}>
              <td className="px-5 py-2.5 text-muted">{dateTime(e.createdAt)}</td>
              <td className="px-3 py-2.5 font-mono text-xs">{e.action}</td>
              <td className="px-3 py-2.5">{e.salonId ? <Link to={`/admin/salons/${e.salonId}`} className="hover:underline">{e.salonName}</Link> : '—'}</td>
              <td className="px-3 py-2.5">
                {e.actorEmail ?? 'system'} {e.impersonatorId && <Badge tone="danger">support</Badge>}
              </td>
              <td className="px-3 py-2.5 text-xs text-muted">{e.ip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Users() {
  const [q, setQ] = useState('');
  const { data, reload } = useApi<{ users: { id: string; email: string; name: string; isPlatformAdmin: boolean; disabled: boolean; lastLoginAt: number | null }[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`);
  return (
    <Card>
      <CardHeader title="Users" action={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email" className="h-9 rounded-lg border border-border bg-surface px-3 text-sm" />} />
      <ul className="divide-y divide-border text-sm">
        {data?.users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="flex-1">
              <span className="font-medium">{u.name}</span> <span className="text-muted">{u.email}</span>
            </span>
            {u.isPlatformAdmin && <Badge tone="danger">admin</Badge>}
            <span className="text-xs text-muted">last login {dateTime(u.lastLoginAt)}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  await api.patch(`/api/admin/users/${u.id}`, { disabled: !u.disabled });
                  await reload();
                } catch (err) {
                  alert(errorMessage(err));
                }
              }}
            >
              {u.disabled ? 'Enable' : 'Disable'}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function AdminOps() {
  const [tab, setTab] = useState<'announcements' | 'messages' | 'audit' | 'users'>('announcements');
  return (
    <div className="space-y-6">
      <PageHeader title="Operations" />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'announcements', label: 'Announcements' },
          { value: 'messages', label: 'Messages' },
          { value: 'audit', label: 'Audit log' },
          { value: 'users', label: 'Users' },
        ]}
      />
      {tab === 'announcements' && <Announcements />}
      {tab === 'messages' && <Messages />}
      {tab === 'audit' && <Audit />}
      {tab === 'users' && <Users />}
    </div>
  );
}
