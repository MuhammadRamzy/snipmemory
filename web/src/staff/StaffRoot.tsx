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

const StaffHome = lazy(() => import('./StaffHome'));
const MePage = lazy(() => import('./MePage'));
const BillPage = lazy(() => import('../shared/BillPage'));
const Bills = lazy(() => import('../shared/Bills'));
const BillDetail = lazy(() => import('../shared/BillDetail'));
const Queue = lazy(() => import('../shared/Queue'));
const Help = lazy(() => import('../shared/Help'));

const NAV: NavItem[] = [
  { to: '/staff', label: 'Home', icon: 'home', end: true },
  { to: '/staff/queue', label: 'Queue', icon: 'ticket' },
  { to: '/staff/bill', label: 'New bill', icon: 'plus', center: true },
  { to: '/staff/bills', label: 'My bills', icon: 'receipt' },
  { to: '/staff/me', label: 'Me', icon: 'user' },
];

function StaffApp() {
  const { me, loading, refresh } = useSessionMaybe();
  const { pathname } = useLocation();
  if (!me) return loading ? <Loading /> : <Login app="staff" onDone={refresh} />;
  if (me.user?.mustChangePin) return <ChangePin length={4} forced onDone={refresh} />;
  if (me.shop.suspendedAt) {
    return (
      <Screen title={me.shop.name} noNavPad>
        <Notice tone="danger" icon="lock" title={t('This shop is paused')}>{t('Please tell your shop owner.')}</Notice>
      </Screen>
    );
  }
  return (
    <>
      <Announcements />
      <PendingBanner shopId={me.shop.id} />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route index element={<StaffHome />} />
          <Route path="bill" element={<BillPage app="staff" />} />
          <Route path="bills" element={<Bills app="staff" />} />
          <Route path="bills/:id" element={<BillDetail app="staff" />} />
          <Route path="queue" element={<Queue app="staff" />} />
          <Route path="me" element={<MePage />} />
          <Route path="help" element={<Help app="staff" />} />
          <Route path="pin" element={<ChangePin length={me.me.role === 'staff' ? 4 : 6} back="/staff/me" onDone={() => history.back()} />} />
          <Route path="*" element={<Navigate to="/staff" replace />} />
        </Routes>
      </Suspense>
      {pathname !== '/staff/bill' && <BottomNav items={NAV.map((n) => ({ ...n, label: t(n.label) }))} pathname={pathname} />}
    </>
  );
}

export default function StaffRoot() {
  setApp('staff');
  return (
    <SessionProvider app="staff">
      <StaffApp />
    </SessionProvider>
  );
}
