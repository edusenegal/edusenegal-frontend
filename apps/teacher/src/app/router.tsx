import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StateView } from '@/components/ui';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import LoginPage from '@/features/auth/LoginPage';

const SchoolSelectionPage = lazy(() => import('@/features/auth/SchoolSelectionPage'));

/**
 * Chaque écran est chargé à la demande — même convention que
 * `apps/director` (voir son `app/router.tsx`).
 */
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const SchedulePage = lazy(() => import('@/features/schedule/SchedulePage'));
const MyClassesPage = lazy(() => import('@/features/my-classes/MyClassesPage'));
const ClassRosterPage = lazy(() => import('@/features/my-classes/ClassRosterPage'));
const AttendancePage = lazy(() => import('@/features/attendance/AttendancePage'));
const GradeEntryPage = lazy(() => import('@/features/grades/GradeEntryPage'));
const ClassGradesPage = lazy(() => import('@/features/grades/ClassGradesPage'));
const GradeDisputesPage = lazy(() => import('@/features/grade-disputes/GradeDisputesPage'));
const ResultsPage = lazy(() => import('@/features/results/ResultsPage'));
const ExamsPage = lazy(() => import('@/features/exams/ExamsPage'));
const CourseDocumentsPage = lazy(() => import('@/features/documents/CourseDocumentsPage'));
const QuizPage = lazy(() => import('@/features/quiz/QuizPage'));
const LeavesPage = lazy(() => import('@/features/leaves/LeavesPage'));
const PayslipsPage = lazy(() => import('@/features/payslips/PayslipsPage'));
const PersonalDocumentsPage = lazy(() => import('@/features/personal-documents/PersonalDocumentsPage'));
const MessagingPage = lazy(() => import('@/features/messaging/MessagingPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const ComplaintsPage = lazy(() => import('@/features/complaints/ComplaintsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const SignedDocumentsPage = lazy(() => import('@/features/signed-documents/SignedDocumentsPage'));
const NotFoundPage = lazy(() => import('@/features/errors/NotFoundPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<StateView loading />}>
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="choix-ecole" element={<SchoolSelectionPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="emploi-du-temps" element={<SchedulePage />} />
            <Route path="mes-classes" element={<MyClassesPage />} />
            <Route path="mes-classes/:classId" element={<ClassRosterPage />} />
            <Route path="appel" element={<AttendancePage />} />
            <Route path="notes/saisie" element={<GradeEntryPage />} />
            <Route path="notes/classe" element={<ClassGradesPage />} />
            <Route path="reclamations-notes" element={<GradeDisputesPage />} />
            <Route path="resultats" element={<ResultsPage />} />
            <Route path="examens" element={<ExamsPage />} />
            <Route path="documents" element={<CourseDocumentsPage />} />
            <Route path="quiz" element={<QuizPage />} />
            <Route path="conges" element={<LeavesPage />} />
            <Route path="paie" element={<PayslipsPage />} />
            <Route path="mes-documents" element={<PersonalDocumentsPage />} />
            <Route path="documents-signes" element={<SignedDocumentsPage />} />
            <Route path="messagerie" element={<MessagingPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="reclamations" element={<ComplaintsPage />} />
            <Route path="parametres" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
