import { createAcademicResultsApi } from '@/api/academic.api';
import { createAuthApi } from '@/api/auth.api';
import { createBilanAnnuelApi } from '@/api/bilanAnnuel.api';
import { createExpensesApi } from '@/api/expenses.api';
import { createGradeDisputesApi } from '@/api/gradeDisputes.api';
import { createClassesApi } from '@/api/classes.api';
import { createDashboardApi } from '@/api/dashboard.api';
import { createPaymentsApi } from '@/api/payments.api';
import { createPersonalDocumentsApi } from '@/api/personalDocuments.api';
import { createPromotionsApi } from '@/api/promotions.api';
import { createRoomsApi } from '@/api/rooms.api';
import { createSchoolApi } from '@/api/school.api';
import { createSignerAssetsApi } from '@/api/signerAssets.api';
import { createSignaturesApi } from '@/api/signatures.api';
import { createStaffAbsencesApi } from '@/api/staffAbsences.api';
import { createStudentsApi } from '@/api/students.api';
import { createSubjectsApi } from '@/api/subjects.api';
import { createTeachersApi } from '@/api/teachers.api';
import { createTransfersApi } from '@/api/transfers.api';
import { createMockServices } from '@/services/mock';
import type { Services } from '@/services/ports';

/**
 * Assemblage des services HTTP.
 *
 * Portage en cours, écran par écran, dans l'ordre existant de l'application
 * (voir `src/app/router.tsx` et `src/app/navigation.ts`) — pas dans un ordre
 * dicté par le backend. `auth` est le premier posé : sans connexion réelle,
 * rien d'autre n'est testable. Les ports non encore portés délèguent pour
 * l'instant à `createMockServices()`, remplacés ici un par un au fur et à
 * mesure ; aucun écran n'a à changer entre-temps.
 */
export function createApiServices(): Services {
  const fallback = createMockServices();

  return {
    ...fallback,
    auth: createAuthApi(),
    // Portage complet — voir le commentaire de `createClassesApi`.
    classes: createClassesApi(),
    students: { ...fallback.students, ...createStudentsApi() },
    subjects: createSubjectsApi(),
    // Portage complet — voir le commentaire de `createTeachersApi`.
    teachers: createTeachersApi(),
    // Portage complet — voir le commentaire de `createStaffAbsencesApi`.
    staffAbsences: createStaffAbsencesApi(),
    // `get`/`save` (configuration tarifaire) restent sur le mock — voir le
    // commentaire de `createPaymentsApi`.
    paymentConfig: { ...fallback.paymentConfig, ...createPaymentsApi() },
    // Portage complet (task #210) — voir le commentaire de `createAcademicResultsApi`.
    academicResults: createAcademicResultsApi(),
    // Portage complet (task #218) — création/consultation seulement, voir
    // le commentaire de `ExpensesPort`.
    expenses: createExpensesApi(),
    // `updateBranding` (task #231, couleurs), `getSchool`, `uploadLogo` et
    // `updateContactInfo` (logo/téléphone/e-mail) sont réels ;
    // `listAcademicYears`/l'assistant d'ouverture d'année restent sur le mock — voir
    // le commentaire de `createSchoolApi`.
    school: { ...fallback.school, ...createSchoolApi() },
    // Portage partiel (task #214/#215) — `previewInternal`/`executeInternal`
    // seulement, voir le commentaire de `createTransfersApi`.
    transfers: { ...fallback.transfers, ...createTransfersApi() },
    // Portage complet (task #217) — voir le commentaire de `createRoomsApi`.
    rooms: createRoomsApi(),
    // Portage complet (task #233) — voir le commentaire de `createPromotionsApi`.
    promotions: createPromotionsApi(),
    // Portage partiel -- `getMyAssets`/`updateMyAssets` (task #230) et
    // `listDocuments`/`listBulletinPeriods`/`signForStudent`/`signBulk`
    // pour les BULLETINS (seul type de document généré côté backend) sont
    // réels ; `signForStaff` et le reste des types de document lèvent une
    // erreur explicite (voir `createSignaturesApi`) ; `importToSign` reste
    // sur le mock (aucun endpoint backend équivalent).
    signatures: { ...fallback.signatures, ...createSignerAssetsApi(), ...createSignaturesApi() },
    // Portage complet (task #236) — voir le commentaire de `createDashboardApi`.
    dashboard: createDashboardApi(),
    // Portage complet (task #237) — voir le commentaire de `createBilanAnnuelApi`.
    bilanAnnuel: createBilanAnnuelApi(),
    // Réclamations de notes (demande explicite) — décision directeur uniquement,
    // voir le commentaire de `createGradeDisputesApi`.
    gradeDisputes: createGradeDisputesApi(),
    // CORRECTION (signalé) — restait sur le mock : un document personnel
    // ajouté depuis la fiche enseignant/élève n'atteignait jamais
    // document-service, donc n'apparaissait nulle part ailleurs (ex.
    // l'onglet Documents de l'application mobile élève). Voir le
    // commentaire de `createPersonalDocumentsApi`.
    personalDocuments: createPersonalDocumentsApi(),
  };
}
