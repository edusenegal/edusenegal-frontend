/**
 * DTO du backend EduSénégal.
 *
 * Ces formes recopient volontairement les réponses Java déjà posées côté
 * backend (class-service, user-service, schedule-service, signature-service,
 * school-service…) — champs, enums et casse à l'identique — pour que la
 * branche `api`, le jour où elle arrive, n'ait qu'à écrire les appels HTTP
 * sans jamais retoucher `src/types/domain.ts` ni les écrans.
 *
 * Aucun composant n'importe ce fichier directement : seule la couche
 * `services/` (ou plus tard `api/`) le fait, puis traduit vers `domain.ts`.
 */

export type SchoolTypeDto = 'PUBLIC_PRIMAIRE' | 'PUBLIC_SECONDAIRE' | 'PRIVE_PRIMAIRE' | 'PRIVE_SECONDAIRE' | 'UNIVERSITE';

export type UserRoleDto =
  | 'SUPER_ADMIN'
  | 'DIRECTOR'
  | 'TEACHER'
  | 'INSTITUTEUR'
  | 'ACCOUNTANT'
  | 'PARENT'
  | 'STUDENT'
  | 'CANTEEN_STAFF';

export type AccountStatusDto = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'ARCHIVED';

/** class-service — ClassResponse. */
export interface ClassResponseDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  level: string; // "Seconde", "Première", "Terminale"
  series: string | null; // "S1", "S2", "L"
  tag: string | null; // "A", "B" — null si division unique
  groupKey: string;
  fullName: string; // "Terminale S2 A"
  schoolType: SchoolTypeDto;
  homeroomTeacherId: string | null;
  itinerantTeacherIds: string[];
  studentCount: number;
  capacity: number;
  createdAt: string;
  updatedAt: string;
}

/** user-service — UserResponse (couvre enseignants, personnel et élèves). */
export interface SchoolProfileDto {
  schoolId: string;
  schoolIndicatif: string;
  schoolUserId: string;
  role: UserRoleDto;
  status: string;
}

export interface UserResponseDto {
  id: string;
  schoolUserId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  role: UserRoleDto;
  accountStatus: AccountStatusDto;
  mustChangePassword: boolean;
  studentCardId: string | null;
  activeSchoolId: string;
  schoolIndicatif: string;
  schools: SchoolProfileDto[];
}

/** user-service — StudentSummaryResponse. */
export interface StudentSummaryResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  classId: string;
  dateOfBirth: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  photoUrl: string | null;
}

/** schedule-service — LeaveRequestResponse / CreateLeaveRequest. */
export type LeaveStatusDto = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequestResponseDto {
  id: string;
  schoolId: string;
  teacherId: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  reason: string;
  documentUrls: string[];
  status: LeaveStatusDto;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  replacementTeacherId: string | null;
  createdAt: string;
}

/** signature-service — SignatureRecordResponse / SignedDocumentResponse. */
export type DocumentTypeDto = 'BULLETIN' | 'CERTIFICATE' | 'OFFICIAL' | 'ATTESTATION' | 'RELEVE_NOTES' | 'OTHER';

export interface SignatureRecordResponseDto {
  id: string;
  schoolId: string;
  signerId: string;
  documentType: DocumentTypeDto;
  documentRef: string;
  documentHash: string;
  signatureHash: string;
  signerRole: string;
  signerName: string;
  valid: boolean;
  signedAt: string;
  serialNumber: string;
}

/**
 * subject-service — SubjectResponse / CreateSubjectRequest /
 * UpdateCoefficientsRequest. `schoolTypeScope` utilise l'énumération
 * `SchoolType` du `common-lib` (PRESCHOOL/PRIMARY/COLLEGE/LYCEE/UNIVERSITY) —
 * distincte de `SchoolTypeDto` ci-dessus, propre à school-service.
 */
export interface CoefficientEntryDto {
  classId: string;
  level: string;
  series: string | null;
  tag: string | null;
  value: number; // coefficient — 0 = facultatif
  active: boolean; // false = non enseignée dans cette classe
}

export interface SubjectResponseDto {
  id: string;
  schoolId: string | null; // null = matière du catalogue global
  global: boolean;
  code: string;
  names: Record<string, string>; // { fr: "Mathématiques", ar: "...", wo: "..." }
  schoolTypeScope: 'PRESCHOOL' | 'PRIMARY' | 'COLLEGE' | 'LYCEE' | 'UNIVERSITY';
  optional: boolean;
  coefficients: CoefficientEntryDto[];
  createdAt: string;
  updatedAt: string;
}

/**
 * payment-service — ConfigurePaymentRequest / PaymentConfigResponse.
 * `POST /api/v1/payments/config` fait office d'upsert (une config par
 * école) ; `GET /api/v1/payments/config/{schoolId}` répond 404 tant
 * qu'aucune configuration n'a été enregistrée.
 */
export type PaymentTypeDto =
  | 'INSCRIPTION_ONLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'ANNUAL'
  | 'INSCRIPTION_MONTHLY'
  | 'INSCRIPTION_QUARTERLY'
  | 'INSCRIPTION_ANNUAL'
  | 'SCHOLARSHIP';

export type PaymentChannelDto = 'WAVE' | 'ORANGE_MONEY' | 'CASH' | 'CHEQUE' | 'VIREMENT_BANCAIRE';

export interface LevelPricingDto {
  level: string;
  series: string | null;
  displayName: string;
  inscriptionFcfa: number;
  periodFcfa: number;
  totalAnnualFcfa: number; // calculé côté appelant — le backend le stocke tel quel
}

export interface PaymentConfigResponseDto {
  id: string;
  schoolId: string;
  type: PaymentTypeDto;
  levelPricings: LevelPricingDto[];
  installmentAllowed: boolean;
  maxInstallments: number;
  deferredAllowed: boolean;
  maxDeferDays: number;
  alertDaysBefore: number;
  enabledChannels: PaymentChannelDto[];
  updatedAt: string;
}

/**
 * payment-service — catégorie "SALAIRES" de la dépense d'établissement.
 * Les demandes groupées du module RH se traduisent, côté API, en une
 * dépense par agent dans cette catégorie — pas encore de DTO dédié
 * "demande de salaire" côté backend à ce jour.
 */
export type ExpenseCategoryDto =
  | 'SALAIRES'
  | 'FOURNITURES_BUREAU'
  | 'MATERIEL_PEDAGOGIQUE'
  | 'ELECTRICITE'
  | 'EAU'
  | 'INTERNET'
  | 'LOYER'
  | 'MAINTENANCE'
  | 'TRANSPORT'
  | 'COMMUNICATION'
  | 'FRAIS_BANCAIRES'
  | 'AUTRES';
