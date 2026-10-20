import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { BottomNav, Loading, Notice, Screen, type NavItem } from '../components/ui';
import { setApp } from '../lib/api';
import { t } from '../lib/i18n';
import { SessionProvider, useSessionMaybe } from '../lib/session';
import { ChangePin } from '../shared/ChangePin';
import { Login } from '../shared/Login';
import { PendingBanner } from '../shared/PendingBanner';
import { Announcements } from '../shared/Announcements';

const Signup = lazy(() => import('./Signup'));
const Setup = lazy(() => import('./Setup'));
const Home = lazy(() => import('./Home'));
const BillPage = lazy(() => import('../shared/BillPage'));
const Bills = lazy(() => import('../shared/Bills'));
const BillDetail = lazy(() => import('../shared/BillDetail'));
const Customers = lazy(() => import('./Customers'));
const CustomerDetail = lazy(() => import('./CustomerDetail'));
const More = lazy(() => import('./More'));
const Staff = lazy(() => import('./Staff'));
const StaffDetail = lazy(() => import('./StaffDetail'));
const Services = lazy(() => import('./Services'));
const Products = lazy(() => import('./Products'));
const Expenses = lazy(() => import('./Expenses'));
const Reports = lazy(() => import('./Reports'));
const Closing = lazy(() => import('./Closing'));
const Queue = lazy(() => import('../shared/Queue'));
const Settings = lazy(() => import('./Settings'));
const Plan = lazy(() => import('./Plan'));
const Help = lazy(() => import('../shared/Help'));

const NAV: NavItem[] = [
  { to: '/owner', label: 'Home', icon: 'home', end: true },
  { to: '/owner/bills', label: 'Bills', icon: 'receipt' },
  { to: '/owner/bill', label: 'New bill', icon: 'plus', center: true },
  { to: '/owner/customers', label: 'Customers', icon: 'users' },
  { to: '/owner/more', label: 'More', icon: 'grid' },
];

function OwnerApp() {
  const { me, loading, refresh } = useSessionMaybe();
  const { pathname } = useLocation();

  if (!me) {
    if (loading) return <Loading />;
    return (
      <Routes>
        <Route path="signup" element={<Signup onDone={refresh} />} />
        <Route path="*" element={<Login app="owner" onDone={refresh} />} />
      </Routes>
    );
  }
  if (me.user?.mustChangePin) return <ChangePin length={6} forced onDone={refresh} />;
  if (me.shop.suspendedAt && !me.impersonating) {
    return (
      <Screen title={me.shop.name} noNavPad>
        <Notice tone="danger" icon="lock" title={t('This shop is paused')}>{me.shop.suspendedReason ?? t('Please contact SnipMemory support on WhatsApp.')}</Notice>
      </Screen>
    );
  }

  const hideNav = pathname === '/owner/bill' || pathname.startsWith('/owner/setup');
  return (
    <>
      {me.impersonating && <div className="bg-danger px-4 py-1.5 text-center text-sm font-bold text-white">{t('Support view — every action is recorded')}</div>}
      <Announcements />
      <PendingBanner shopId={me.shop.id} />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route index element={me.shop.onboardedAt ? <Home /> : <Navigate to="/owner/setup" replace />} />
          <Route path="setup" element={<Setup />} />
          <Route path="signup" element={<Navigate to="/owner" replace />} />
          <Route path="bill" element={<BillPage app="owner" />} />
          <Route path="bills" element={<Bills app="owner" />} />
          <Route path="bills/:id" element={<BillDetail app="owner" />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="more" element={<More />} />
          <Route path="staff" element={<Staff />} />
          <Route path="staff/:id" element={<StaffDetail />} />
          <Route path="services" element={<Services />} />
          <Route path="products" element={<Products />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="reports" element={<Reports />} />
          <Route path="closing" element={<Closing />} />
          <Route path="queue" element={<Queue app="owner" />} />
          <Route path="settings" element={<Settings />} />
          <Route path="plan" element={<Plan />} />
          <Route path="help" element={<Help app="owner" />} />
          <Route path="pin" element={<ChangePin length={6} back="/owner/more" onDone={() => history.back()} />} />
          <Route path="*" element={<Navigate to="/owner" replace />} />
        </Routes>
      </Suspense>
      {!hideNav && <BottomNav items={NAV.map((n) => ({ ...n, label: t(n.label) }))} pathname={pathname} />}
    </>
  );
}

export default function OwnerRoot() {
  setApp('owner');
  return (
    <SessionProvider app="owner">
      <OwnerApp />
    </SessionProvider>
  );
}
