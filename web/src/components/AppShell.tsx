import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { date, relative } from '../lib/format';
import { SalonProvider } from '../lib/salon';
import type { SalonContextData } from '../lib/types';
import { useApi } from '../lib/useApi';
import { Icons, Logo } from './icons';
import { Alert, Button, PageLoader, cx } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: keyof typeof Icons;
  end?: boolean;
  show: (ctx: { canManage: boolean; isOwner: boolean }) => boolean;
}

const NAV: NavItem[] = [
  { to: '/app', label: 'Today', icon: 'home', end: true, show: () => true },
  { to: '/app/clients', label: 'Clients', icon: 'users', show: () => true },
  { to: '/app/reminders', label: 'Reminders', icon: 'bell', show: () => true },
  { to: '/app/team', label: 'Team', icon: 'team', show: ({ canManage }) => canManage },
  { to: '/app/settings', label: 'Settings', icon: 'settings', show: ({ canManage }) => canManage },
  { to: '/app/billing', label: 'Billing', icon: 'card', show: ({ isOwner }) => isOwner },
];

function Announcements() {
  const { data } = useApi<{ announcements: { id: string; message: string; level: 'info' | 'warning' | 'critical' }[] }>('/api/public/announcements');
  if (!data?.announcements.length) return null;
  return (
    <div className="space-y-2">
      {data.announcements.map((a) => (
        <Alert key={a.id} tone={a.level === 'critical' ? 'danger' : a.level === 'warning' ? 'warning' : 'accent'}>
          {a.message}
        </Alert>
      ))}
    </div>
  );
}

export default function AppShell() {
  const { me, station, loading, activeSalonId, setActiveSalonId, logout, refresh, refreshStation } = useAuth();
  const [data, setData] = useState<SalonContextData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const load = useCallback(async () => {
    if (!activeSalonId) return;
    try {
      setData(await api.get<SalonContextData>(`/api/salons/${activeSalonId}`));
      setError(null);
    } catch (err) {
      setError(err as ApiError);
    }
  }, [activeSalonId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (loading) return <PageLoader />;
  if (!activeSalonId) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (error?.code === 'station_locked' || (data && data.viewer.kind === 'station' && !data.viewer.role)) {
    return <Navigate to="/station" replace />;
  }
  if (error) {
    return (
      <div className="mx-auto max-w-md p-6 pt-24 text-center">
        <p className="mb-4 text-muted">{error.message}</p>
        <Button onClick={() => (error.status === 401 ? navigate('/login') : load())}>{error.status === 401 ? 'Sign in' : 'Try again'}</Button>
      </div>
    );
  }
  if (!data) return <PageLoader />;

  const { salon, viewer, plan } = data;
  const canManage = viewer.kind === 'user' && (viewer.role === 'owner' || viewer.role === 'manager');
  const isOwner = viewer.kind === 'user' && viewer.role === 'owner';
  const items = NAV.filter((n) => n.show({ canManage, isOwner }));
  const memberships = me?.memberships ?? [];
  const trialDays = salon.trialEndsAt ? Math.max(0, Math.ceil((salon.trialEndsAt - Date.now()) / 86_400_000)) : null;

  const lockStation = async () => {
    await api.post('/api/station/lock');
    await refreshStation();
    navigate('/station');
  };
  const stopImpersonating = async () => {
    await api.post('/api/auth/impersonation/stop');
    await refresh();
    navigate('/admin');
  };
  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <Link to="/app" className="mb-3 px-2 pt-1">
        <Logo />
      </Link>
      {memberships.length > 1 ? (
        <select
          aria-label="Switch salon"
          value={salon.id}
          onChange={(e) => setActiveSalonId(e.target.value)}
          className="mb-3 h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm font-semibold"
        >
          {memberships.map((m) => (
            <option key={m.salon.id} value={m.salon.id}>
              {m.salon.name}
            </option>
          ))}
        </select>
      ) : (
        <div className="mb-3 truncate rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold">{salon.name}</div>
      )}
      {items.map((item) => {
        const Icon = Icons[item.icon];
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-text')
            }
          >
            <Icon size={18} />
            {item.label}
          </NavLink>
        );
      })}
      <div className="mt-auto space-y-2 pt-4">
        <div className="rounded-xl border border-border p-3 text-xs">
          <p className="font-semibold">{plan.name} plan</p>
          {salon.subscriptionStatus === 'trialing' && trialDays !== null ? (
            <p className="text-muted">Trial ends {relative(salon.trialEndsAt)}</p>
          ) : (
            <p className="text-muted">{salon.messageCredits + salon.bonusCredits} reminder credits</p>
          )}
          {isOwner && plan.id !== 'chain' && (
            <Link to="/app/billing" className="mt-1 inline-block font-semibold text-accent">
              Upgrade
            </Link>
          )}
        </div>
        {me?.user?.isPlatformAdmin && !me.impersonating && (
          <Link to="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2">
            <Icons.shield size={18} /> Platform admin
          </Link>
        )}
        {viewer.kind === 'station' ? (
          <button onClick={lockStation} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2">
            <Icons.lock size={18} /> Lock · {station?.acting?.displayName}
          </button>
        ) : (
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2">
            <Icons.logout size={18} /> Sign out
          </button>
        )}
      </div>
    </nav>
  );

  return (
    <SalonProvider data={data} reload={load}>
      <div className="min-h-dvh lg:pl-64">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">{sidebar}</aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
          <Link to="/app" className="min-w-0 truncate font-bold">
            {salon.name}
          </Link>
          <div className="flex items-center gap-1">
            {viewer.kind === 'station' && (
              <Button variant="ghost" size="sm" onClick={lockStation}>
                <Icons.lock size={16} /> {station?.acting?.displayName}
              </Button>
            )}
            <button className="rounded-lg p-2 hover:bg-surface-2" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <Icons.menu />
            </button>
          </div>
        </header>
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
            <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
            <aside className="animate-in absolute inset-y-0 right-0 w-72 max-w-[85vw] border-l border-border bg-surface">{sidebar}</aside>
          </div>
        )}

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          <div className="mb-5 space-y-2 empty:hidden">
            {viewer.impersonating && (
              <Alert tone="danger" title="Support session" action={<Button size="sm" variant="danger" onClick={stopImpersonating}>End session</Button>}>
                You are viewing {salon.name} as SnipMemory support. Every action is audited.
              </Alert>
            )}
            {salon.suspendedAt && <Alert tone="danger" title="Account suspended">{salon.suspendedReason ?? 'Contact support to restore access.'}</Alert>}
            {salon.subscriptionStatus === 'past_due' && isOwner && (
              <Alert tone="warning" title="Payment failed" action={<Link className="font-semibold underline" to="/app/billing">Update payment</Link>}>
                We couldn't charge your card. Update it to keep automated reminders running.
              </Alert>
            )}
            {salon.subscriptionStatus === 'trialing' && trialDays !== null && trialDays <= 5 && isOwner && (
              <Alert tone="accent" title={`Your trial ends ${date(salon.trialEndsAt, { day: 'numeric', month: 'short' })}`} action={<Link className="font-semibold underline" to="/app/billing">Choose a plan</Link>}>
                After that you'll move to the Free plan — your clients and photos stay safe.
              </Alert>
            )}
            <Announcements />
          </div>
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-border bg-surface/95 pt-2 backdrop-blur lg:hidden">
          {NAV.slice(0, 3).map((item) => {
            const Icon = Icons[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cx('flex flex-col items-center gap-0.5 text-xs font-medium', isActive ? 'text-accent' : 'text-muted')}
              >
                <Icon size={22} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </SalonProvider>
  );
}
