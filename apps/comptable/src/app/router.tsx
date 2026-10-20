import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StateView } from '@/components/ui';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import LoginPage from '@/features/auth/LoginPage';

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const ExpensesPage = lazy(() => import('@/features/expenses/ExpensesPage'));
const CashSessionPage = lazy(() => import('@/features/cash-session/CashSessionPage'));
const LedgerPage = lazy(() => import('@/features/ledger/LedgerPage'));
const SalaryPaymentsPage = lazy(() => import('@/features/salary-payments/SalaryPaymentsPage'));
const WalletPage = lazy(() => import('@/features/wallets/WalletPage'));
const PaymentsPage = lazy(() => import('@/features/payments/PaymentsPage'));
const ScholarshipsPage = lazy(() => import('@/features/scholarships/ScholarshipsPage'));
const NotFoundPage = lazy(() => import('@/features/errors/NotFoundPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<StateView loading />}>
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="depenses" element={<ExpensesPage />} />
            <Route path="caisse" element={<CashSessionPage />} />
            <Route path="grand-livre" element={<LedgerPage />} />
            <Route path="salaires" element={<SalaryPaymentsPage />} />
            <Route path="portefeuilles" element={<WalletPage />} />
            <Route path="paiements" element={<PaymentsPage />} />
            <Route path="bourses" element={<ScholarshipsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
