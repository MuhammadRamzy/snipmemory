import { useState, type FormEvent } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { Logo } from '../components/icons';
import { Badge, Button, Card, Chips, ErrorBox, Input, Loading, Notice, Section, Stat, cx, useUi } from '../components/ui';
import { api, message, setApp } from '../lib/api';
import { date, dateTime, phoneDisplay, rs } from '../lib/format';
import type { Plan, Shop } from '../lib/types';
import { useApi } from '../lib/useApi';

export default function AdminRoot() {
  setApp('admin');
  const { data, error, reload, loading } = useApi<{ name: string }>('/api/admin/me');
  if (loading && !data) return <Loading />;
  if (error || !data) return <AdminLogin onDone={reload} />;
  return <AdminShell name={data.name} />;
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/admin/login', { phone, password });
      onDone();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4 px-4 pt-20">
      <Logo />
      <h1 className="text-2xl font-extrabold">SnipMemory admin</h1>
      {error && <Notice tone="danger" icon="alert" title={error} />}
      <Input label="Phone" prefix="+91" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button type="submit" block size="lg" loading={busy}>
        Login
      </Button>
    </form>
  );
}

const TABS = [
  ['/admin', 'Overview'],
  ['/admin/payments', 'Payments'],
  ['/admin/shops', 'Shops'],
  ['/admin/plans', 'Plans'],
  ['/admin/ops', 'Announcements & audit'],
] as const;

function AdminShell({ name }: { name: string }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 overflow-x-auto px-4">
          <Logo size={30} />
          <Badge tone="danger">ADMIN</Badge>
          <nav className="flex gap-1">
            {TABS.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => cx('whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-bold', isActive ? 'bg-brand-soft text-brand-text' : 'text-muted')}>
                {label}
              </NavLink>
            ))}
          </nav>
          <span className="ml-auto whitespace-nowrap text-sm text-muted">{name}</span>
          <button
            className="text-sm font-bold text-muted"
            onClick={async () => {
              await api.post('/api/admin/logout');
              navigate(0);
            }}
          >
            Logout
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="payments" element={<Payments />} />
          <Route path="shops" element={<Shops />} />
          <Route path="shops/:id" element={<ShopDetail />} />
          <Route path="plans" element={<Plans />} />
          <Route path="ops" element={<Ops />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

interface Metrics {
  shops: number;
  trial: number;
  paid: number;
  free: number;
  active7d: number;
  mrr: number;
  byPlan: Record<string, number>;
  pendingPayments: number;
  signups30d: number;
  bills30d: number;
  gmv30d: number;
  collected30d: number;
  signupSeries: { day: string; n: number }[];
}

function Overview() {
  const { data, error, reload } = useApi<Metrics>('/api/admin/metrics');
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!data) return <Loading />;
  const max = Math.max(1, ...data.signupSeries.map((s) => s.n));
  return (
    <div className="space-y-6">
      {data.pendingPayments > 0 && (
        <NavLink to="/admin/payments">
          <Notice tone="warn" icon="clock" title={`${data.pendingPayments} UPI payments waiting for verification`} />
        </NavLink>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="MRR" value={rs(data.mrr)} sub={`ARR ${rs(data.mrr * 12)}`} tone="money" />
        <Stat label="Paying shops" value={data.paid} sub={Object.entries(data.byPlan).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'} />
        <Stat label="In trial" value={data.trial} sub={`${data.signups30d} signups in 30 days`} />
        <Stat label="Active (billed in 7d)" value={data.active7d} sub={`${data.shops} shops total`} />
        <Stat label="Free plan" value={data.free} />
        <Stat label="Bills · 30d" value={data.bills30d.toLocaleString('en-IN')} />
        <Stat label="GMV billed · 30d" value={rs(data.gmv30d)} sub="Salon sales through POS" />
        <Stat label="Collected · 30d" value={rs(data.collected30d)} sub="Approved subscriptions" tone="brand" />
      </div>
      <Card className="p-5">
        <p className="font-bold">Signups — last 30 days</p>
        <div className="mt-4 flex h-32 items-end gap-1">
          {data.signupSeries.map((s) => (
            <div key={s.day} title={`${s.day}: ${s.n}`} className="flex-1 rounded-t bg-brand" style={{ height: `${Math.max(3, (s.n / max) * 100)}%`, opacity: s.n ? 1 : 0.25 }} />
          ))}
        </div>
      </Card>
    </div>
  );
}

interface PaymentRow {
  id: string;
  shopId: string;
  shopName: string;
  city: string | null;
  ownerPhone: string;
  planId: string;
  period: string;
  amount: number;
  utr: string;
  status: string;
  note: string | null;
  createdAt: number;
}

function Payments() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const { data, error, reload } = useApi<{ payments: PaymentRow[] }>(`/api/admin/payments?status=${status}`);
  const { ask, toast } = useUi();
  const decide = async (p: PaymentRow, decision: 'approve' | 'reject') => {
    const note = decision === 'reject' ? await ask({ title: 'Reject payment?', input: { label: 'Reason shown to the shop', required: true }, confirm: 'Reject', danger: true }) : await ask({ title: `Approve ${rs(p.amount)} from ${p.shopName}?`, body: `Check UTR ${p.utr} is in the bank statement.`, confirm: 'Approve' });
    if (!note) return;
    try {
      await api.post(`/api/admin/payments/${p.id}/${decision}`, typeof note === 'string' ? { note } : {});
      toast(decision === 'approve' ? 'Plan activated' : 'Rejected');
      void reload();
    } catch (err) {
      toast(message(err), 'error');
    }
  };
  return (
    <div className="space-y-4">
      <Chips value={status} onChange={setStatus} options={[{ value: 'pending', label: 'Waiting' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
      <ErrorBox error={error} retry={reload} />
      {!data ? (
        <Loading />
      ) : data.payments.length === 0 ? (
        <p className="py-10 text-center text-muted">Nothing here.</p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {data.payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <NavLink to={`/admin/shops/${p.shopId}`} className="font-bold hover:underline">
                  {p.shopName}
                </NavLink>
                <p className="text-sm text-muted">
                  {p.city} · {phoneDisplay(p.ownerPhone)} · {dateTime(p.createdAt)}
                </p>
                <p className="font-mono text-sm">UTR {p.utr}</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold">{rs(p.amount)}</p>
                <p className="text-sm text-muted">
                  {p.planId} · {p.period}
                </p>
              </div>
              {status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => decide(p, 'reject')}>
                    Reject
                  </Button>
                  <Button size="sm" variant="money" onClick={() => decide(p, 'approve')}>
                    Approve
                  </Button>
                </div>
              )}
              {p.note && <p className="w-full text-sm text-muted">{p.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ShopRow = Shop & { ownerName: string; ownerPhone: string; staffCount: number; bills7d: number; lastBillAt: number | null };

function Shops() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const { data, error, reload } = useApi<{ shops: ShopRow[] }>(`/api/admin/shops?q=${encodeURIComponent(q)}&filter=${filter}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shop, city, owner phone" className="h-12 flex-1 rounded-2xl border-2 border-line bg-surface px-4 outline-none focus:border-brand" />
        <Chips value={filter} onChange={setFilter} options={['all', 'trial', 'paid', 'free', 'suspended'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} />
      </div>
      <ErrorBox error={error} retry={reload} />
      {!data ? (
        <Loading />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-muted">
              <tr>
                <th className="p-3">Shop</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Staff</th>
                <th className="p-3">Bills 7d</th>
                <th className="p-3">Last bill</th>
                <th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.shops.map((s) => (
                <tr key={s.id}>
                  <td className="p-3">
                    <NavLink to={`/admin/shops/${s.id}`} className="font-bold hover:underline">
                      {s.name}
                    </NavLink>
                    <p className="text-muted">{s.city}</p>
                  </td>
                  <td className="p-3">
                    {s.ownerName}
                    <p className="text-muted">{phoneDisplay(s.ownerPhone)}</p>
                  </td>
                  <td className="p-3">
                    {s.planId} {s.trial && <Badge tone="brand">trial</Badge>} {s.suspendedAt && <Badge tone="danger">paused</Badge>}
                    <p className="text-muted">{s.planExpiresAt ? `till ${date(s.planExpiresAt)}` : ''}</p>
                  </td>
                  <td className="p-3">{s.staffCount}</td>
                  <td className="p-3">{s.bills7d}</td>
                  <td className="p-3 text-muted">{s.lastBillAt ? dateTime(s.lastBillAt) : '—'}</td>
                  <td className="p-3 text-muted">{date(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ShopDetail() {
  const { id } = useParams();
  const { ask, toast } = useUi();
  const { data, error, reload } = useApi<{
    shop: Shop;
    owner: { name: string; phone: string; last_login_at: number | null };
    staff: { id: string; name: string; role: string; active: number; phone: string }[];
    payments: PaymentRow[];
    audit: { id: string; action: string; meta: string; createdAt: number }[];
    stats: { bills: number; gmv30d: number; customers: number };
  }>(`/api/admin/shops/${id}`);
  const plans = useApi<{ plans: Plan[] }>('/api/admin/plans');
  const [planId, setPlanId] = useState('');
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!data) return <Loading />;
  const s = data.shop;
  const patch = async (body: Record<string, unknown>) => {
    try {
      await api.patch(`/api/admin/shops/${s.id}`, body);
      toast('Saved');
      void reload();
    } catch (err) {
      toast(message(err), 'error');
    }
  };
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">{s.name}</h1>
        <p className="text-muted">
          {s.city} · {data.owner.name} {phoneDisplay(data.owner.phone)} · joined {date(s.createdAt)} · UPI {s.upiVpa ?? '—'}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Bills (all time)" value={data.stats.bills} />
        <Stat label="GMV · 30d" value={rs(data.stats.gmv30d)} />
        <Stat label="Customers" value={data.stats.customers} />
      </div>
      <Card className="space-y-4 p-5">
        <p className="font-bold">
          Plan: {s.planId} {s.trial && '(trial)'} {s.planExpiresAt && `till ${date(s.planExpiresAt)}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="h-11 rounded-xl border-2 border-line bg-surface px-3">
            <option value="">Change plan…</option>
            {plans.data?.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={!planId} onClick={() => patch({ planId })}>
            Set plan
          </Button>
          <Button size="sm" variant="secondary" onClick={() => patch({ extendDays: 30 })}>
            +30 days
          </Button>
          <Button size="sm" variant="secondary" onClick={() => patch({ extendDays: 365 })}>
            +1 year
          </Button>
          {s.suspendedAt ? (
            <Button size="sm" variant="secondary" onClick={() => patch({ suspended: false })}>
              Un-pause
            </Button>
          ) : (
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                const reason = await ask({ title: 'Pause shop?', input: { label: 'Reason shown to the owner', required: true }, confirm: 'Pause', danger: true });
                if (typeof reason === 'string' && reason) void patch({ suspended: true, suspendedReason: reason });
              }}
            >
              Pause
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              if (!(await ask({ title: 'Reset owner PIN?', body: 'Only after verifying the owner on a call. They must set a new PIN at next login.', confirm: 'Reset', danger: true }))) return;
              const res = await api.post<{ tempPin: string }>(`/api/admin/shops/${s.id}/reset-owner-pin`);
              await ask({ title: `Temporary PIN: ${res.tempPin}`, body: 'Tell the owner this PIN. It works once; they choose a new one after login.', confirm: 'Done', cancel: 'Close' });
            }}
          >
            Reset owner PIN
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const reason = await ask({ title: 'Open owner app as support?', input: { label: 'Reason (recorded)', required: true }, confirm: 'Open' });
              if (typeof reason !== 'string' || reason.length < 5) return;
              await api.post(`/api/admin/shops/${s.id}/impersonate`, { reason });
              window.open('/owner', '_blank');
            }}
          >
            Open as support (1 hour)
          </Button>
        </div>
      </Card>
      <Section title="Staff">
        <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {data.staff.map((m) => (
            <div key={m.id} className="flex justify-between p-3 text-sm">
              <span className="font-semibold">{m.name}</span>
              <span className="text-muted">
                {m.role} · {phoneDisplay(m.phone)} {!m.active && '· removed'}
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Subscription payments">
        <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {data.payments.map((p) => (
            <div key={p.id} className="flex justify-between p-3 text-sm">
              <span>
                {dateTime(p.createdAt)} · {p.planId}/{p.period} · UTR {p.utr}
              </span>
              <span className="font-bold">
                {rs(p.amount)} · {p.status}
              </span>
            </div>
          ))}
          {!data.payments.length && <p className="p-3 text-sm text-muted">None</p>}
        </div>
      </Section>
      <Section title="Audit">
        <div className="max-h-80 divide-y divide-line overflow-y-auto rounded-3xl border border-line bg-surface">
          {data.audit.map((a) => (
            <div key={a.id} className="p-3 text-sm">
              <span className="font-mono">{a.action}</span> <span className="text-muted">{dateTime(a.createdAt)}</span>
              {a.meta !== '{}' && <p className="truncate text-muted">{a.meta}</p>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Plans() {
  const { data, error, reload } = useApi<{ plans: (Plan & { isPublic: boolean })[] }>('/api/admin/plans');
  const { toast } = useUi();
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!data) return <Loading />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.plans.map((p) => (
        <PlanEditor
          key={p.id}
          plan={p}
          onSave={async (body) => {
            try {
              await api.put(`/api/admin/plans/${p.id}`, body);
              toast('Saved');
              void reload();
            } catch (err) {
              toast(message(err), 'error');
            }
          }}
        />
      ))}
    </div>
  );
}

function PlanEditor({ plan, onSave }: { plan: Plan & { isPublic: boolean }; onSave: (body: Record<string, unknown>) => void }) {
  const [f, setF] = useState({
    name: plan.name,
    tagline: plan.tagline,
    maxStaff: String(plan.maxStaff),
    limit: String(plan.monthlyBillLimit),
    month: String(plan.priceMonth / 100),
    year: String(plan.priceYear / 100),
    features: plan.features.join('\n'),
  });
  return (
    <Card className="space-y-3 p-5">
      <p className="font-mono text-sm text-muted">{plan.id}</p>
      <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Input label="Tagline" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Max people (-1 = ∞)" value={f.maxStaff} onChange={(e) => setF({ ...f, maxStaff: e.target.value })} />
        <Input label="Bills / month (-1 = ∞)" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} />
        <Input label="₹ / month" prefix="₹" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} />
        <Input label="₹ / year" prefix="₹" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} />
      </div>
      <label className="block">
        <span className="mb-1 block font-semibold">Features (one per line)</span>
        <textarea className="min-h-32 w-full rounded-2xl border-2 border-line bg-surface p-3" value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} />
      </label>
      <Button
        block
        onClick={() =>
          onSave({
            name: f.name,
            tagline: f.tagline,
            maxStaff: Number(f.maxStaff),
            monthlyBillLimit: Number(f.limit),
            priceMonth: Math.round(Number(f.month) * 100),
            priceYear: Math.round(Number(f.year) * 100),
            features: f.features.split('\n').map((x) => x.trim()).filter(Boolean),
            isPublic: plan.isPublic,
          })
        }
      >
        Save
      </Button>
    </Card>
  );
}

function Ops() {
  const ann = useApi<{ announcements: { id: string; message: string; level: string; active: number; createdAt: number }[] }>('/api/admin/announcements');
  const audit = useApi<{ entries: { id: string; shopName: string | null; action: string; userName: string | null; impersonatorId: string | null; createdAt: number }[] }>('/api/admin/audit');
  const { toast } = useUi();
  const [msg, setMsg] = useState('');
  const [level, setLevel] = useState<'info' | 'warning' | 'critical'>('info');
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="text-lg font-bold">Announcements (shown in apps)</p>
        <Input label="Message" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <Chips value={level} onChange={setLevel} options={[{ value: 'info', label: 'Info' }, { value: 'warning', label: 'Warning' }, { value: 'critical', label: 'Critical' }]} />
        <Button
          disabled={msg.trim().length < 3}
          onClick={async () => {
            try {
              await api.post('/api/admin/announcements', { message: msg, level, hours: 72 });
              setMsg('');
              void ann.reload();
            } catch (err) {
              toast(message(err), 'error');
            }
          }}
        >
          Publish for 3 days
        </Button>
        <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          {ann.data?.announcements.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>
                <Badge tone={a.level === 'critical' ? 'danger' : a.level === 'warning' ? 'warn' : 'brand'}>{a.level}</Badge> {a.message}
              </span>
              <Button size="sm" variant="secondary" onClick={async () => { await api.patch(`/api/admin/announcements/${a.id}`, { active: !a.active }); void ann.reload(); }}>
                {a.active ? 'Hide' : 'Show'}
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-3 text-lg font-bold">Audit log</p>
        <div className="max-h-[70vh] divide-y divide-line overflow-y-auto rounded-3xl border border-line bg-surface">
          {audit.data?.entries.map((e) => (
            <div key={e.id} className="p-3 text-sm">
              <span className="font-mono">{e.action}</span> {e.impersonatorId && <Badge tone="danger">support</Badge>}
              <p className="text-muted">
                {e.shopName ?? '—'} · {e.userName ?? 'system'} · {dateTime(e.createdAt)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
