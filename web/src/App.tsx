import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { PageLoader } from './components/ui';
import { useAuth } from './lib/auth';
import Landing from './pages/marketing/Landing';

const Pricing = lazy(() => import('./pages/marketing/Pricing'));
const Legal = lazy(() => import('./pages/marketing/Legal'));
const SalonPage = lazy(() => import('./pages/marketing/SalonPage'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const Invite = lazy(() => import('./pages/auth/Invite'));
const Passport = lazy(() => import('./pages/passport/Passport'));
const Station = lazy(() => import('./pages/station/Station'));
const AppShell = lazy(() => import('./components/AppShell'));
const Dashboard = lazy(() => import('./pages/app/Dashboard'));
const Clients = lazy(() => import('./pages/app/Clients'));
const ClientDetail = lazy(() => import('./pages/app/ClientDetail'));
const NewVisit = lazy(() => import('./pages/app/NewVisit'));
const Reminders = lazy(() => import('./pages/app/Reminders'));
const Team = lazy(() => import('./pages/app/Team'));
const Settings = lazy(() => import('./pages/app/Settings'));
const Billing = lazy(() => import('./pages/app/Billing'));
const Welcome = lazy(() => import('./pages/app/Welcome'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminSalons = lazy(() => import('./pages/admin/AdminSalons'));
const AdminSalonDetail = lazy(() => import('./pages/admin/AdminSalonDetail'));
const AdminPlans = lazy(() => import('./pages/admin/AdminPlans'));
const AdminOps = lazy(() => import('./pages/admin/AdminOps'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!me?.user) return <Navigate to="/login?next=/admin" replace />;
  if (!me.user.isPlatformAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/privacy" element={<Legal page="privacy" />} />
          <Route path="/terms" element={<Legal page="terms" />} />
          <Route path="/s/:slug" element={<SalonPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/invite/:token" element={<Invite />} />
          <Route path="/passport" element={<Passport />} />
          <Route path="/station" element={<Station />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="welcome" element={<Welcome />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:clientId" element={<ClientDetail />} />
            <Route path="clients/:clientId/visit" element={<NewVisit />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="team" element={<Team />} />
            <Route path="settings" element={<Settings />} />
            <Route path="billing" element={<Billing />} />
          </Route>
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="salons" element={<AdminSalons />} />
            <Route path="salons/:salonId" element={<AdminSalonDetail />} />
            <Route path="plans" element={<AdminPlans />} />
            <Route path="ops" element={<AdminOps />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
