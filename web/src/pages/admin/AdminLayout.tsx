import { NavLink, Outlet, useNavigate } from 'react-router';
import { Icons, Logo } from '../../components/icons';
import { cx } from '../../components/ui';
import { useAuth } from '../../lib/auth';

const NAV = [
  { to: '/admin', label: 'Overview', icon: 'chart', end: true },
  { to: '/admin/salons', label: 'Salons', icon: 'store' },
  { to: '/admin/plans', label: 'Plans & pricing', icon: 'card' },
  { to: '/admin/ops', label: 'Operations', icon: 'megaphone' },
] as const;

export default function AdminLayout() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 overflow-x-auto px-4">
          <Logo className="shrink-0" />
          <span className="rounded-md bg-danger-soft px-2 py-0.5 text-xs font-bold uppercase text-danger">Admin</span>
          <nav className="flex gap-1">
            {NAV.map((n) => {
              const Icon = Icons[n.icon];
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={'end' in n}
                  className={({ isActive }) => cx('flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium', isActive ? 'bg-surface-2 text-text' : 'text-muted hover:text-text')}
                >
                  <Icon size={16} /> {n.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3 text-sm">
            <span className="hidden text-muted md:inline">{me?.user?.email}</span>
            {me?.memberships.length ? (
              <NavLink to="/app" className="text-muted hover:text-text">
                My salon
              </NavLink>
            ) : null}
            <button
              className="text-muted hover:text-text"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
