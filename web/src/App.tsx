import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Loading, UiProvider } from './components/ui';

const Landing = lazy(() => import('./site/Landing'));
const Legal = lazy(() => import('./site/Legal'));
const PublicBill = lazy(() => import('./site/PublicBill'));
const OwnerRoot = lazy(() => import('./owner/OwnerRoot'));
const StaffRoot = lazy(() => import('./staff/StaffRoot'));
const AdminRoot = lazy(() => import('./admin/AdminRoot'));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  return (
    <UiProvider>
      <ScrollTop />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Landing scrollTo="pricing" />} />
          <Route path="/privacy" element={<Legal page="privacy" />} />
          <Route path="/terms" element={<Legal page="terms" />} />
          <Route path="/b/:token" element={<PublicBill />} />
          <Route path="/owner/*" element={<OwnerRoot />} />
          <Route path="/staff/*" element={<StaffRoot />} />
          <Route path="/admin/*" element={<AdminRoot />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </UiProvider>
  );
}
