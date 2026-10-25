/**
 * Transcription fidèle des DTO du backend EduSénégal.
 * Ces types décrivent ce qui circule sur le réseau : ils ne sont jamais
 * utilisés tels quels par l'interface, qui consomme les types de
 * `domain.ts`. Chaque `*.api.ts` traduit l'un vers l'autre.
 *
 * Point de départ : l'authentification seule (voir `auth.api.ts`). Les DTO
 * des autres ports (classes, enseignants, élèves…) s'ajoutent ici au fur et
 * à mesure de leur portage, dans l'ordre de l'écran existant — voir le
 * README, section "Les deux branches".
 */

/** Calqué sur `common-lib` `UserRole` — seuls les rôles de direction sont utiles ici. */
export type UserRole =
  | 'SUPER_ADMIN'
  | 'DIRECTOR'
  | 'VICE_RECTOR'
  | 'SECRETARY_GENERAL'
  | 'DEAN'
  | 'DEPARTMENT_HEAD'
  | 'LAB_DIRECTOR'
  | 'HR_DIRECTOR'
  | 'FINANCE_DIRECTOR'
  | 'REGISTRAR'
  | 'IT_MANAGER'
  | 'BOARD_MEMBER'
  | 'TEACHER'
  | 'INSTITUTEUR'
  | 'SUPERVISOR'
  | 'LIBRARIAN'
  | 'ACCOUNTANT'
  | 'CANTEEN_STAFF'
  | 'CENSEUR'
  | 'STUDENT'
  | 'PHD_STUDENT'
  | 'PARENT'
  | 'GUARDIAN';

/** Calqué sur `common-lib` `SchoolType`. */
export type ApiSchoolType = 'PRESCHOOL' | 'PRIMARY' | 'COLLEGE' | 'LYCEE' | 'UNIVERSITY';

/** Calqué sur `common-lib` `SchoolOwnership`. */
export type SchoolOwnership = 'PUBLIC' | 'PRIVATE';

/** POST /api/v1/auth/login */
export interface LoginRequestDto {
  identifier: string;
  password: string;
  loginByPhone: boolean;
  schoolId?: string;
}

/** POST /api/v1/auth/refresh */
export interface RefreshRequestDto {
  refreshToken: string;
  /** Jeton applicatif encore connu, même périmé — retrouve l'école active. */
  accessToken?: string;
}

/** Réponse de /auth/login, /auth/refresh et /auth/switch-school. */
export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId?: string;
  role?: UserRole;
  activeSchoolId?: string;
  schoolType?: ApiSchoolType;
  schoolIndicatif?: string;
  schoolUserId?: string;
  /** Classe de l'élève actif — toujours absente pour un profil direction. */
  classId?: string;
  schools?: string[];
  mustChangePassword: boolean;
}

/** GET /api/v1/users/{userId} */
/** `sn.edusenegal.userservice.service.enums.Sexe`. */
export type ApiSexe = 'MASCULIN' | 'FEMININ';

export type GradeDisputeStatusDto =
  | 'PENDING_TEACHER'
  | 'PENDING_SUPERVISOR'
  | 'PENDING_DIRECTOR'
  | 'PENDING_TEACHER_DIRECTED'
  | 'RESOLVED_APPROVED'
  | 'RESOLVED_REJECTED';

export interface GradeDisputeHistoryEntryDto {
  action: string;
  actorId: string;
  actorRole: string;
  comment: string | null;
  at: string;
}

export interface GradeDisputeResponseDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  gradeId: string;
  studentId: string;
  classId: string;
  subjectId: string;
  subjectName: string | null;
  teacherId: string;
  disputedValue: number;
  currentValue: number | null;
  reason: string;
  status: GradeDisputeStatusDto;
  history: GradeDisputeHistoryEntryDto[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface EscalatedDisputeDecisionRequestDto {
  action: 'ESCALATE' | 'REJECT' | 'ORDER_CORRECTION';
  comment?: string | null;
}

export interface UserResponseDto {
  id: string;
  schoolUserId?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  role: UserRole;
  accountStatus?: string;
  mustChangePassword: boolean;
  studentCardId?: string;
  activeSchoolId?: string;
  schoolIndicatif?: string;
  schools?: {
    schoolId: string;
    schoolIndicatif: string;
    schoolUserId: string;
    role: UserRole;
    status: string;
  }[];
  // CORRECTION — ces six champs sont désormais rendus par `UserResponse`
  // (voir le commentaire côté backend) ; absents du DTO jusqu'ici alors que
  // `User` les portait déjà (sauf `sexe`, nouvellement persisté aussi).
  sexe?: ApiSexe;
  /** ISO-8601 (`java.util.Date` sérialisé par Jackson). */
  birthDate?: string;
  address?: string;
  photoUrl?: string;
  /** Élève uniquement — jusqu'à 3 ids parent. */
  parentIds?: string[];
  /** Enseignant uniquement — ids de matière (`subject-service`), pas des noms. */
  subjectIds?: string[];
}

/** POST /api/v1/users */
export interface CreateUserRequestDto {
  schoolId: string;
  role: UserRole;
  cni?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  sexe?: ApiSexe;
  /** ISO-8601. */
  birthDate?: string;
  birthPlace?: string;
  address?: string;
  classId?: string;
  parentIds?: string[];
  status?: 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'TRANSFERRED';
}

/**
 * PUT /api/v1/users/{userId}. `phone`/`address`/`birthDate`/`status`
 * ajoutés pour que la fiche « modifier élève » persiste réellement — voir
 * le correctif côté backend (`UpdateUserRequest`).
 */
export interface UpdateUserRequestDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  status?: 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'TRANSFERRED';
}

/** Calqué sur `common-lib` `SalaryMode` (user-service / payment-service). */
export type ApiSalaryMode = 'FIXED' | 'PER_WORKED_DAY' | 'PER_HOUR';

/** PUT /api/v1/users/{userId}/schools/{schoolId}/salary */
export interface UpdateSalaryRequestDto {
  salaryMode: ApiSalaryMode;
  fixedAmountFcfa?: number;
  dailyRateFcfa?: number;
  hourlyRateFcfa?: number;
}

/** Réponse de `PUT`/`GET .../salary` (user-service). */
export interface SchoolSalaryProfileResponseDto {
  userId: string;
  schoolId: string;
  role: UserRole;
  salaryMode: ApiSalaryMode | null;
  fixedAmountFcfa: number | null;
  dailyRateFcfa: number | null;
  hourlyRateFcfa: number | null;
}

/** Calqué sur `PaymentChannel` (payment-service) — WAVE, ORANGE_MONEY, CASH, CHEQUE, VIREMENT_BANCAIRE. */
export type ApiPaymentChannel = 'WAVE' | 'ORANGE_MONEY' | 'CASH' | 'CHEQUE' | 'VIREMENT_BANCAIRE';

/** Calqué sur `SalaryPaymentStatus` (payment-service). */
export type ApiSalaryPaymentStatus = 'DRAFT' | 'PENDING_VALIDATION' | 'VALIDATED' | 'REJECTED' | 'CANCELLED';

/** Calqué sur `PayoutStatus` (payment-service). */
export type ApiPayoutStatus = 'PENDING' | 'PAID' | 'FAILED' | 'AWAITING_CASH_CONFIRMATION' | 'DISPUTED';

/** Une entrée de `CreateSalaryPaymentRequestDto.lines`. */
export interface SalaryLineInputDto {
  staffUserId: string;
  workedDays?: number;
  workedHours?: number;
  paymentMethod?: ApiPaymentChannel;
  payoutDestination?: string;
}

/** POST /api/v1/accounting/salary-requests (payment-service). */
export interface CreateSalaryPaymentRequestDto {
  schoolId: string;
  academicYearId: string;
  periodLabel: string; // "2026-10"
  periodStart: string; // ISO LocalDate (yyyy-MM-dd)
  periodEnd: string;
  lines: SalaryLineInputDto[];
}

/** Calqué sur `SalaryLineResponse` (payment-service). */
export interface SalaryLineResponseDto {
  staffUserId: string;
  staffFullName: string;
  role: UserRole;
  salaryMode: ApiSalaryMode;
  fixedAmountFcfa: number | null;
  dailyRateFcfa: number | null;
  hourlyRateFcfa: number | null;
  workedDays: number | null;
  workedHours: number | null;
  unjustifiedAbsenceDays: number | null;
  computedAmountFcfa: number | null;
  payerOwnership: SchoolOwnership;
  expenseId: string | null;
  payslipId: string | null;
  paymentMethod: ApiPaymentChannel;
  payoutDestination: string | null;
  payoutStatus: ApiPayoutStatus;
  payoutTransactionRef: string | null;
  payoutFailureReason: string | null;
}

/** Calqué sur `SalaryPaymentRequestResponse` (payment-service). */
export interface SalaryPaymentRequestResponseDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  periodLabel: string;
  periodStart: string; // ISO LocalDate
  periodEnd: string;
  lines: SalaryLineResponseDto[];
  totalAmountFcfa: number;
  status: ApiSalaryPaymentStatus;
  validationHistory: ApiValidationStep[] | null;
  createdBy: string;
  validatedBy: string | null;
  validatedAt: string | null; // ISO LocalDateTime
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  splitFromRequestId: string | null;
  splitIntoRequestId: string | null;
}

/** GET /api/v1/accounting/salary-requests/payslips (payment-service). */
export interface PayslipResponseDto {
  id: string;
  schoolId: string;
  staffUserId: string;
  staffFullName: string;
  salaryPaymentRequestId: string;
  periodLabel: string;
  salaryMode: ApiSalaryMode;
  grossAmountFcfa: number;
  workedDays: number | null;
  workedHours: number | null;
  unjustifiedAbsenceDays: number | null;
  payerOwnership: SchoolOwnership;
  paymentMethod?: string;
  paymentReference?: string;
  generatedBy: string;
  /**
   * ISO-8601 (`LocalDateTime` sérialisé par Jackson). CORRECTION (signalé) :
   * absent si le bulletin a été généré avant l'activation de l'auditing
   * Mongo côté payment-service (voir `MongoConfig`) -- tous les bulletins
   * existants, jusqu'à ce correctif.
   */
  generatedAt: string | null;
}

/** POST /api/v1/staff-absences (attendance-service). */
export interface RecordStaffAbsenceRequestDto {
  schoolId: string;
  staffUserId: string;
  /** ISO-8601 (`yyyy-MM-dd`). */
  dateFrom: string;
  dateTo: string;
  justified: boolean;
  reason?: string;
}

/** Réponse de `POST`/`GET /api/v1/staff-absences` (attendance-service). */
export interface StaffAbsenceResponseDto {
  id: string;
  schoolId: string;
  staffUserId: string;
  dateFrom: string;
  dateTo: string;
  justified: boolean;
  reason: string | null;
  recordedBy: string;
  createdAt: string;
}

/** GET /api/v1/staff-absences/summary (attendance-service). */
export interface StaffAbsenceSummaryResponseDto {
  schoolId: string;
  staffUserId: string;
  unjustifiedAbsenceDays: number;
  justifiedAbsenceDays: number;
}

/** Calqué sur `signature-service` `DocumentType`. */
export type ApiDocumentType = 'BULLETIN' | 'CERTIFICATE' | 'OFFICIAL' | 'ATTESTATION' | 'RELEVE_NOTES' | 'PAYSLIP' | 'OTHER';

/** Réponse de `POST`/`GET /api/v1/signatures/assets` (signature-service). */
export interface SignerAssetResponseDto {
  signerId: string;
  signerName: string;
  signerRole: string;
  hasStamp: boolean;
  hasSignature: boolean;
  stampPreviewUrl: string | null;
  signaturePreviewUrl: string | null;
  updatedAt: string;
}

/** Corps de `POST /api/v1/signatures` (signature-service) -- `documentBytes` en base64. */
export interface SignRequestDto {
  documentType: ApiDocumentType;
  documentRef: string;
  documentBytes: string;
  academicYearId?: string;
  semesterNumber?: number;
  /**
   * SIGNATURE (par défaut côté serveur si omis) appose UNIQUEMENT la
   * signature manuscrite importée (+ signature électronique ECDSA/QR) ;
   * CACHET appose UNIQUEMENT le tampon de l'établissement, sans valeur
   * cryptographique -- deux actions indépendantes.
   */
  action?: 'SIGNATURE' | 'CACHET';
}

/** Réponse de `POST /api/v1/signatures` (signature-service). */
export interface SignedDocumentResponseDto {
  signatureHash: string;
  signedAt: string;
  signerName: string;
  serialNumber: string;
  downloadUrl: string | null;
}

/**
 * Réponse de `GET /api/v1/signatures/document/{schoolId}/{documentRef}`
 * (signature-service) — `documentRef` vaut un id élève/classe pour un
 * bulletin, ou l'id d'un membre du personnel pour une attestation/un
 * document officiel qui le concerne (voir le commentaire de
 * `SignatureRecord.documentRef` côté backend).
 */
export interface SignatureRecordResponseDto {
  id: string;
  schoolId: string;
  signerId: string;
  documentType: ApiDocumentType;
  documentRef: string;
  documentHash: string;
  signatureHash: string;
  signerRole: string;
  signerName: string;
  valid: boolean;
  signedAt: string;
  serialNumber?: string;
  /** Semestre concerné si applicable (BULLETIN) -- absent/`null` sinon. */
  semesterNumber?: number | null;
  /**
   * SIGNATURE ou CACHET -- absent/`null` sur les enregistrements antérieurs
   * à la séparation des deux actions (traités comme SIGNATURE côté front).
   */
  action?: 'SIGNATURE' | 'CACHET' | null;
  /** URL présignée (1h) du PDF final signé -- `null`/absent si pas encore généré. */
  downloadUrl?: string | null;
}

/** Calqué sur `document-service` `PersonalDocumentType`. */
export type ApiPersonalDocumentType = 'CNI' | 'DIPLOMA' | 'CERTIFICATION' | 'BIRTH_CERTIFICATE' | 'PARENT_CNI' | 'OTHER';

/** Calqué sur `document-service` `PersonalDocumentOwnerType`. */
export type ApiPersonalDocumentOwnerType = 'STAFF' | 'STUDENT';

/** Corps JSON de la partie `data` de `POST /api/v1/personal-documents` (multipart). */
export interface UploadPersonalDocumentRequestDto {
  schoolId?: string;
  ownerUserId: string;
  ownerType: ApiPersonalDocumentOwnerType;
  type: ApiPersonalDocumentType;
  academicYearId?: string;
  title: string;
  description?: string;
}

/** Réponse de `POST`/`GET .../owner/{ownerUserId}` (`PersonalDocumentResponse`, document-service). */
export interface PersonalDocumentResponseDto {
  id: string;
  schoolId: string;
  ownerUserId: string;
  ownerType: ApiPersonalDocumentOwnerType;
  type: ApiPersonalDocumentType;
  academicYearId?: string | null;
  title: string;
  description?: string | null;
  downloadUrl: string;
  contentUrl: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedByUserId: string;
  /**
   * `@JsonInclude(NON_NULL)` côté backend : absent (pas `null`) pour les
   * documents créés avant l'activation de l'audit Mongo sur document-service
   * (`@CreatedDate` restait inerte) -- voir `fromPersonalDocumentResponse`.
   */
  createdAt?: string | null;
}

/** Ventilation par élève de `ClassPaymentStatsDto` (task #208). */
export interface StudentPaymentRateDto {
  studentId: string;
  expectedFcfa: number;
  collectedFcfa: number;
  remainingFcfa: number;
  collectionRate: number;
  status: 'PAID' | 'OVERDUE' | 'PENDING' | 'NONE';
}

/** GET /api/v1/payments/stats/by-students */
export interface ClassPaymentStatsDto {
  totalStudents: number;
  paidStudents: number;
  overdueStudents: number;
  pendingStudents: number;
  totalExpectedFcfa: number;
  totalCollectedFcfa: number;
  totalRemainingFcfa: number;
  collectionRate: number;
  byStudent: StudentPaymentRateDto[];
}

/** GET /api/v1/attendance/analytics/students/stats — clé = studentId. */
export type StudentAbsenceStatsDto = Record<
  string,
  { total: number; approved: number; rejected: number; pending: number; justified: number; unjustified: number }
>;

/** Calqué sur `Mention` (academic-service). */
export type ApiMention = 'EXCELLENT' | 'TRES_BIEN' | 'BIEN' | 'ASSEZ_BIEN' | 'PASSABLE' | 'INSUFFISANT';

/** Calqué sur `PromotionResult` (academic-service). */
export type ApiPromotionResult = 'PROMOTED' | 'EXCEPTIONAL' | 'RETAINED' | 'EXCLUDED';

/** Moyenne d'une matière pour un élève — imbriqué dans `SemesterResultResponseDto.subjects`/`YearResultResponseDto.subjects`. */
export interface SubjectAverageDto {
  subjectId: string;
  subjectName: string;
  d1: number | null;
  d2: number | null;
  composition: number | null;
  average: number;
  coefficient: number;
  weightedPoints: number;
  mention: ApiMention;
}

/**
 * GET /api/v1/academic/results/class/{classId}/semester/{semester} — une
 * ligne par élève (task #210 : portage complet d'`AcademicResultsPort`).
 */
export interface SemesterResultResponseDto {
  id: string;
  studentId: string;
  classId: string;
  academicYearId: string;
  semesterNumber: number;
  generalAverage: number;
  rankInClass: number;
  totalStudents: number;
  mention: ApiMention;
  totalWeightedPoints: number;
  totalCoefficients: number;
  subjects: SubjectAverageDto[];
  teacherComment: string | null;
  directorComment: string | null;
  bulletinGenerated: boolean;
  bulletinS3Key: string | null;
  published: boolean;
  createdAt: string;
}

/** GET /api/v1/academic/results/{student|class}/.../annual */
export interface YearResultResponseDto {
  id: string;
  studentId: string;
  classId: string;
  academicYearId: string;
  annualAverage: number;
  rankInClass: number;
  totalStudents: number;
  mention: ApiMention;
  promotionResult: ApiPromotionResult;
  subjects: SubjectAverageDto[];
  directorComment: string | null;
  closed: boolean;
  createdAt: string;
}

/** Calqué sur `PeriodType` (academic-service). */
export type ApiPeriodType = 'SEMESTER' | 'TRIMESTER' | 'ANNUAL';

/** Calqué sur `SemesterPeriod` (academic-service) — ISO (`yyyy-MM-dd`) pour les dates. */
export interface SemesterPeriodDto {
  number: number;
  label: string;
  startDate: string;
  endDate: string;
  gradeDeadline: string;
  bulletinDate: string;
  locked: boolean;
}

/** POST /api/v1/academic/config */
export interface ConfigureAcademicYearRequestDto {
  schoolId: string;
  academicYearId: string;
  classId: string | null;
  levelTarget: string | null;
  periodType: ApiPeriodType;
  semesterCount: number;
  periods: SemesterPeriodDto[];
  d1Weight: number;
  d2Weight: number;
  compositionWeight: number;
  minPassAverage: number;
}

/** GET /api/v1/academic/config/effective, POST /api/v1/academic/config */
export interface AcademicYearConfigResponseDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  levelTarget: string | null;
  classId: string | null;
  periodType: ApiPeriodType;
  semesterCount: number;
  periods: SemesterPeriodDto[];
  d1Weight: number;
  d2Weight: number;
  compositionWeight: number;
  minPassAverage: number;
  configuredBy: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/v1/academic/year/close */
/**
 * Élément de `CloseYearRequestDto.overrides` — décision de promotion forcée
 * par le directeur pour UN élève (passage exceptionnel, redoublement
 * explicite…), task #234. Les élèves absents de cette liste suivent la
 * décision calculée automatiquement (`AcademicServiceImpl#decidePromotion`).
 */
export interface StudentPromotionResultDto {
  studentId: string;
  classId: string;
  annualAverage: number;
  finalResult: ApiPromotionResult;
  directorNote?: string | null;
}

export interface CloseYearRequestDto {
  schoolId: string;
  academicYearId: string;
  directorSignature: string;
  scope: string | null;
  overrides?: StudentPromotionResultDto[];
}

/** GET /api/v1/schools/{schoolId}/academic-years/active, GET .../academic-years */
export interface AcademicYearDto {
  id: string;
  schoolId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
}

/**
 * GET /api/v1/classes/{classId}, GET /api/v1/classes/school/{schoolId}/year/{yearId}
 * `teacherIds` mêle professeur principal + itinérants (F-PED-3) — pas de
 * champ séparé, contrairement à `ClassResponseDto`.
 */
export interface ClassInfoDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  fullName: string;
  level: string;
  series: string | null;
  tag: string | null;
  homeroomTeacherId: string | null;
  defaultRoomId?: string | null;
  schoolType: ApiSchoolType;
  capacity: number;
  studentIds: string[];
  teacherIds: string[];
}

/**
 * POST /api/v1/classes, PUT .../homeroom-teacher/{teacherId},
 * DELETE .../homeroom-teacher
 */
export interface ClassResponseDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  level: string;
  series: string | null;
  tag: string | null;
  groupKey: string;
  fullName: string;
  schoolType: ApiSchoolType;
  homeroomTeacherId: string | null;
  defaultRoomId?: string | null;
  itinerantTeacherIds: string[];
  studentCount: number;
  capacity: number;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/v1/classes */
export interface CreateClassRequestDto {
  schoolId: string;
  academicYearId: string;
  schoolType: ApiSchoolType;
  level: string;
  series: string | null;
  tag: string | null;
  capacity: number;
  classChief?: string;
  homeroomTeacherId?: string;
}

/** GET /api/v1/schools/{schoolId} */
export interface SchoolResponseDto {
  id: string;
  name: string;
  slug?: string;
  sigle?: string | null;
  indicatif: string;
  region?: string;
  type: ApiSchoolType;
  ownership?: SchoolOwnership;
  logoUrl?: string | null;
  emblemeUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  activeAcademicYearId?: string | null;
  directorId?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
}

/** PUT /api/v1/schools/{schoolId} */
export interface UpdateSchoolRequestDto {
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * subject-service — `CoefficientEntry` (embarqué sur `Subject`, pas une
 * collection séparée). `level`/`series`/`tag` viennent de la classe visée
 * (voir `ClassInfoDto`) — résolus côté frontend avant l'appel, le backend ne
 * les déduit pas lui-même.
 */
export interface CoefficientEntryDto {
  classId: string;
  level?: string | null;
  series?: string | null;
  tag?: string | null;
  value: number;
  active: boolean;
}

/** GET /api/v1/subjects/{id}, GET /api/v1/subjects/school/{schoolId}, GET .../global, POST, PUT .../coefficients */
export interface SubjectResponseDto {
  id: string;
  schoolId: string | null;
  global: boolean;
  code: string;
  /** i18n : `{fr: "...", ar: "...", wo: "..."}` — seul `fr` est utilisé ici. */
  names: Record<string, string>;
  schoolTypeScope: ApiSchoolType;
  optional: boolean;
  coefficients: CoefficientEntryDto[];
  createdAt?: string;
  updatedAt?: string;
}

/** POST /api/v1/subjects */
export interface CreateSubjectRequestDto {
  schoolId: string | null;
  code: string;
  names: Record<string, string>;
  schoolTypeScope: ApiSchoolType;
  optional: boolean;
  isGlobal: boolean;
  coefficients?: CoefficientEntryDto[];
}

/** PUT /api/v1/subjects/{id}/coefficients — remplace la liste complète. */
export interface UpdateCoefficientsRequestDto {
  coefficients: CoefficientEntryDto[];
}

// ── schedule-service — calendrier d'évaluations (devoirs/examens/compositions) ──

/** Backend : `sn.edusenegal.scheduleservice.domain.ExamType`. */
export type ApiExamType = 'DEVOIR1' | 'DEVOIR2' | 'COMPOSITION' | 'INTERRO' | 'EXAMEN_BLANC' | 'CONSEIL_DE_CLASSE';

/** GET /api/v1/exams/class/{classId}, POST /api/v1/exams */
export interface ExamCalendarResponseDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  classId: string;
  subjectId: string | null;
  subjectName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  title: string;
  type: ApiExamType;
  semesterNumber: number;
  date: string; // ISO yyyy-MM-dd
  startTime: string;
  endTime: string;
  room: string | null;
  durationMinutes: number;
  visibleToStudents: boolean;
  createdAt?: string;
}

/** POST /api/v1/exams */
export interface ScheduleExamRequestDto {
  schoolId: string;
  academicYearId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  type: ApiExamType;
  semesterNumber: number;
  date: string; // ISO yyyy-MM-dd
  startTime: string;
  endTime: string;
  room?: string | null;
  durationMinutes: number;
}

// ── schedule-service — emploi du temps hebdomadaire (versionné) ──

/** Backend : `sn.edusenegal.scheduleservice.domain.ScheduleType`. */
export type ApiScheduleType = 'WEEKLY' | 'SEMESTER' | 'TRIMESTER' | 'ANNUAL';

/** Jour de semaine côté backend — `MON`..`SAT` (pas de dimanche). */
export type ApiDayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export interface TimetableSlotResponseDto {
  id: string;
  classId: string;
  subjectId: string | null;
  subjectName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  replacementTeacherId?: string | null;
  replacementTeacherName?: string | null;
  dayOfWeek: ApiDayOfWeek;
  startTime: string;
  endTime: string;
  room: string | null;
  grayedOut: boolean;
  weekNumber: number;
  createdAt?: string;
}

export interface TimetableVersionResponseDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  classId: string | null;
  className?: string | null;
  levelTarget?: string | null;
  type: ApiScheduleType;
  semesterNumber: number;
  trimesterNumber: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  active: boolean;
  versionNumber: number;
  slots: TimetableSlotResponseDto[];
}

export interface TimetableSlotEntryDto {
  subjectId: string;
  teacherId: string;
  dayOfWeek: ApiDayOfWeek;
  startTime: string;
  endTime: string;
  room?: string | null;
  weekNumber?: number;
}

/**
 * POST /api/v1/timetables — `createTimetable` désactive déjà la version
 * active précédente et en recrée une (voir `ScheduleServiceImpl`) : c'est le
 * seul appel nécessaire pour CRÉER, AJOUTER/RETIRER un créneau ou ÉDITER
 * l'emploi du temps d'une classe — toujours en renvoyant la liste COMPLÈTE
 * des créneaux voulus pour la nouvelle version.
 */
export interface CreateTimetableRequestDto {
  schoolId: string;
  academicYearId: string;
  classId: string;
  type: ApiScheduleType;
  semesterNumber: number;
  trimesterNumber: number;
  effectiveFrom: string; // ISO yyyy-MM-dd
  slots: TimetableSlotEntryDto[];
}

/** GET /api/v1/users/by-phone/{phone} — recherche avant création d'un enseignant (évite les doublons). */
export interface UserLookupResponseDto {
  id: string;
  phone: string;
  globalRole: string;
  schoolProfiles: { schoolId: string; role: string; status: string }[];
}

/** PUT /api/v1/users/{userId}/schools/{schoolId}/subjects */
export interface UpdateSubjectsRequestDto {
  subjectIds: string[];
}

/** POST /api/v1/users/{userId}/schools — rattacher un utilisateur existant à cet établissement. */
export interface AddToSchoolRequestDto {
  schoolId: string;
  role: UserRole;
  isItinerant: boolean;
}

/** Corps d'erreur renvoyé par la passerelle (`ExceptionHandler` générique). */
export interface ApiErrorDto {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  /** Code métier de la passerelle (ErrorResponse.code), ex. ACCOUNT_SUSPENDED. */
  code?: string;
}

// ════════════════════════════════════════════════════════════════════════
// payment-service — ExpenseController (/api/v1/accounting/expenses)
// ════════════════════════════════════════════════════════════════════════

/** Calqué sur `ExpenseCategory` (payment-service). */
export type ApiExpenseCategory =
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

/** Calqué sur `ExpenseStatus` (payment-service). */
export type ApiExpenseStatus = 'DRAFT' | 'PENDING_VALIDATION' | 'VALIDATED' | 'REJECTED' | 'CANCELLED';

/** Calqué sur `ValidationDecision` (payment-service). */
export type ApiValidationDecision = 'APPROVED' | 'REJECTED';

/** Calqué sur `ValidationStep` (payment-service). */
export interface ApiValidationStep {
  validatorId: string;
  validatorRole: string;
  decision: ApiValidationDecision;
  comment: string | null;
  decidedAt: string;
}

/** POST /api/v1/accounting/expenses */
export interface CreateExpenseRequestDto {
  schoolId: string;
  academicYearId: string;
  category: ApiExpenseCategory;
  label: string;
  amountFcfa: number;
  expenseDate: string;
  supplierName?: string;
}

/** Calqué sur `ExpenseResponse` (payment-service). */
export interface ExpenseResponseDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  category: ApiExpenseCategory;
  label: string;
  amountFcfa: number;
  expenseDate: string;
  supplierName: string | null;
  status: ApiExpenseStatus;
  createdBy: string;
  validatedBy: string | null;
  validatedAt: string | null;
  rejectionReason: string | null;
  attachmentUrls: string[] | null;
  validationHistory: ApiValidationStep[] | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/v1/accounting/expenses — page Spring Data standard. */
export interface ApiPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ── Transfert interne (task #214/#215) — academic-service, TransferController.

export interface InternalTransferMatchedSubjectDto {
  subjectId: string;
  subjectName: string;
  coefficientInFromClass: number;
  coefficientInToClass: number;
}

export interface InternalTransferOrphanSubjectDto {
  subjectId: string;
  subjectName: string;
  coefficientInFromClass: number;
  hasExistingGrades: boolean;
}

export interface InternalTransferCandidateSubjectDto {
  subjectId: string;
  subjectName: string;
  coefficientInToClass: number;
}

/** GET /api/v1/academic/transfers/internal/preview */
export interface InternalTransferPreviewResponseDto {
  studentId: string;
  fromClassId: string;
  toClassId: string;
  sameSchool: boolean;
  cheapPathEligible: boolean;
  matchedSubjects: InternalTransferMatchedSubjectDto[];
  orphanSubjects: InternalTransferOrphanSubjectDto[];
  candidateReplacementSubjects: InternalTransferCandidateSubjectDto[];
}

export interface ExecuteInternalTransferMappingDto {
  orphanSubjectId: string;
  replacementSubjectId: string;
  gradeValue: number | null;
  semesterNumber: number | null;
}

/** POST /api/v1/academic/transfers/internal/execute */
export interface ExecuteInternalTransferRequestDto {
  studentId: string;
  fromClassId: string;
  toClassId: string;
  mappings: ExecuteInternalTransferMappingDto[];
}

export interface InternalTransferExecuteResponseDto {
  studentId: string;
  fromClassId: string;
  toClassId: string;
  subjectsCarriedOver: number;
  subjectsExcluded: number;
  subjectsCreated: number;
}

// ── Salles de classe (task #217) — schedule-service, ClassRoomController.

export interface ClassRoomDto {
  id: string;
  schoolId: string;
  name: string;
  capacity: number;
  classId?: string | null;
}

export interface CreateClassRoomRequestDto {
  schoolId: string;
  name: string;
  capacity: number;
  classId?: string;
}

export interface UpdateClassRoomRequestDto {
  name: string;
  capacity: number;
}

export interface RoomAvailabilityResponseDto {
  roomId: string;
  roomName: string;
  capacity: number;
  available: boolean;
  conflictReason: string | null;
}

// ── Dashboard (task #236) — attendance-service, payment-service.

/** GET /api/v1/attendances/analytics/school/stats */
export interface AttendanceStatsResponseDto {
  scope: 'SCHOOL' | 'CLASS' | 'SUBJECT';
  scopeId: string;
  from: string;
  to: string;
  totalRecords: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  attendanceRate: number;
}

/** GET /api/v1/attendances/analytics/school/classes-stats — item #400. */
export interface ClassAttendanceStatsResponseDto {
  classId: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
}

/** Élément de `AttendanceSheetResponseDto.students`. */
export interface StudentAttendanceViewDto {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';
  note: string | null;
}

/** GET /api/v1/attendances/analytics/class/sheet(/range) */
export interface AttendanceSheetResponseDto {
  schoolId: string;
  classId: string;
  subjectId: string | null;
  date: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
  students: StudentAttendanceViewDto[];
}

/** `attendance-service`, `AbsenceRequest` — item #402. */
export interface AbsenceRequestDto {
  id: string;
  schoolId: string;
  studentId: string;
  academicYearId: string;
  absenceDateFrom: string;
  absenceDateTo: string;
  subjectIds: string[];
  reason: string | null;
  justificationUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'LOCKED';
  visibleToParents: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
}

/** GET /api/v1/accounting/ledger — payment-service, LedgerController. */
export interface LedgerResponseDto {
  schoolId: string;
  academicYearId: string;
  totalIncomesFcfa: number;
  totalExpensesFcfa: number;
  balanceFcfa: number;
  lastUpdatedAt: string;
}

/** Statut d'une demande de congé — `schedule-service`, `LeaveStatus`. */
export type ApiLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** `schedule-service`, `LeaveRequestResponse` (`/api/v1/leaves/...`). */
export interface LeaveRequestResponseDto {
  id: string;
  schoolId: string;
  teacherId: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  reason: string;
  documentUrls: string[];
  status: ApiLeaveStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  replacementTeacherId: string | null;
  createdAt: string;
}

/** `schedule-service`, `ReviewLeaveRequest` (`PUT /api/v1/leaves/{id}/review`). */
export interface ReviewLeaveRequestDto {
  status: 'APPROVED' | 'REJECTED';
  note?: string;
  replacementTeacherId?: string;
}
