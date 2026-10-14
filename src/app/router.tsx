import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StateView } from '@/components/ui';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import LoginPage from '@/features/auth/LoginPage';

/**
 * Chaque écran est chargé à la demande : la direction qui ouvre
 * l'application au tableau de bord ne télécharge pas l'écran Paramètres
 * tant qu'elle ne l'a pas ouvert.
 */
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const ClassesListPage = lazy(() => import('@/features/classes/ClassesListPage'));
const ClassDetailPage = lazy(() => import('@/features/classes/ClassDetailPage'));
const TeachersListPage = lazy(() => import('@/features/teachers/TeachersListPage'));
const TeacherDetailPage = lazy(() => import('@/features/teachers/TeacherDetailPage'));
const StudentsListPage = lazy(() => import('@/features/students/StudentsListPage'));
const StudentDetailPage = lazy(() => import('@/features/students/StudentDetailPage'));
const SubjectsListPage = lazy(() => import('@/features/subjects/SubjectsListPage'));
const SubjectDetailPage = lazy(() => import('@/features/subjects/SubjectDetailPage'));
const AcademicResultsPage = lazy(() => import('@/features/academic-results/AcademicResultsPage'));
const PaymentConfigPage = lazy(() => import('@/features/payments/PaymentConfigPage'));
const PromotionsPage = lazy(() => import('@/features/promotions/PromotionsPage'));
const TransfersPage = lazy(() => import('@/features/transfers/TransfersPage'));
const AcademicYearPage = lazy(() => import('@/features/academic-year/AcademicYearPage'));
const OpenYearWizard = lazy(() => import('@/features/academic-year/wizard/OpenYearWizard'));
const LeavesPage = lazy(() => import('@/features/leaves/LeavesPage'));
const SalaryRequestsPage = lazy(() => import('@/features/salary-requests/SalaryRequestsPage'));
const SignaturesPage = lazy(() => import('@/features/signatures/SignaturesPage'));
const NoticesPage = lazy(() => import('@/features/notices/NoticesPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const NotFoundPage = lazy(() => import('@/features/errors/NotFoundPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<StateView loading />}>
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="classes" element={<ClassesListPage />} />
            <Route path="classes/:classId" element={<ClassDetailPage />} />
            <Route path="enseignants" element={<TeachersListPage />} />
            <Route path="enseignants/:teacherId" element={<TeacherDetailPage />} />
            <Route path="eleves" element={<StudentsListPage />} />
            <Route path="eleves/:studentId" element={<StudentDetailPage />} />
            <Route path="matieres" element={<SubjectsListPage />} />
            <Route path="matieres/:subjectId" element={<SubjectDetailPage />} />
            <Route path="resultats" element={<AcademicResultsPage />} />
            <Route path="paiements" element={<PaymentConfigPage />} />
            <Route path="promotions" element={<PromotionsPage />} />
            <Route path="transferts" element={<TransfersPage />} />
            <Route path="annee-scolaire" element={<AcademicYearPage />} />
            <Route path="annee-scolaire/ouvrir" element={<OpenYearWizard />} />
            <Route path="conges" element={<LeavesPage />} />
            <Route path="salaires" element={<SalaryRequestsPage />} />
            <Route path="signatures" element={<SignaturesPage />} />
            <Route path="notes-de-service" element={<NoticesPage />} />
            <Route path="parametres" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
