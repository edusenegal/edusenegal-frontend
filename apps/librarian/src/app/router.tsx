import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StateView } from '@/components/ui';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import LoginPage from '@/features/auth/LoginPage';

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const CataloguePage = lazy(() => import('@/features/catalogue/CataloguePage'));
const EmpruntsPage = lazy(() => import('@/features/emprunts/EmpruntsPage'));
const RetardsPage = lazy(() => import('@/features/retards/RetardsPage'));
const ReservationsPage = lazy(() => import('@/features/reservations/ReservationsPage'));
const AdherentsPage = lazy(() => import('@/features/adherents/AdherentsPage'));
const PolitiquePage = lazy(() => import('@/features/politique/PolitiquePage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const NotFoundPage = lazy(() => import('@/features/errors/NotFoundPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<StateView loading />}>
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="catalogue" element={<CataloguePage />} />
            <Route path="emprunts" element={<EmpruntsPage />} />
            <Route path="retards" element={<RetardsPage />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="adherents" element={<AdherentsPage />} />
            <Route path="politique" element={<PolitiquePage />} />
            <Route path="profil" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
