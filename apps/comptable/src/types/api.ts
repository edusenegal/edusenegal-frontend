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

/** Ventilation par élève de `ClassPaymentStatsDto` (task #208). */
export interface StudentPaymentRateDto {
  studentId: string;
  expectedFcfa: number;
  collectedFcfa: number;
  remainingFcfa: number;
  collectionRate: number;
  status: 'PAID' | 'PARTIAL' | 'OVERDUE' | 'PENDING' | 'NONE';
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
export interface CloseYearRequestDto {
  schoolId: string;
  academicYearId: string;
  directorSignature: string;
  scope: string | null;
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
  active: boolean;
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
  /**
   * Code métier structuré (ex. `INSUFFICIENT_FUNDS`) -- voir
   * `GlobalExceptionHandler.ErrorResponse` côté backend. Absent/non géré :
   * le message reste générique (voir `toAxiosAppError`), jamais le message
   * technique brut du backend.
   */
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
  decidedAt: string; // ISO LocalDateTime
}

/** POST /api/v1/accounting/expenses */
export interface CreateExpenseRequestDto {
  schoolId: string;
  academicYearId: string;
  category: ApiExpenseCategory;
  label: string;
  amountFcfa: number;
  expenseDate: string; // ISO LocalDate (yyyy-MM-dd)
  supplierName?: string;
}

/** POST /api/v1/accounting/expenses/{id}/validate */
export interface ValidateExpenseRequestDto {
  decision: ApiValidationDecision;
  comment?: string;
}

/** Calqué sur `ExpenseResponse` (payment-service). */
export interface ExpenseResponseDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  category: ApiExpenseCategory;
  label: string;
  amountFcfa: number;
  expenseDate: string; // ISO LocalDate
  supplierName: string | null;
  status: ApiExpenseStatus;
  createdBy: string;
  validatedBy: string | null;
  validatedAt: string | null; // ISO LocalDateTime
  rejectionReason: string | null;
  /** Solde de l'école juste avant / après cette dépense — non nul une fois VALIDATED. */
  balanceBeforeFcfa: number | null;
  balanceAfterFcfa: number | null;
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

// ════════════════════════════════════════════════════════════════════════
// payment-service — CashSessionController (/api/v1/accounting/cash-sessions)
// ════════════════════════════════════════════════════════════════════════

/** Calqué sur `CashSessionStatus` (payment-service). */
export type ApiCashSessionStatus = 'OPEN' | 'CLOSED';

/** Calqué sur `PaymentChannel` (payment-service) — clés de `CashSessionResponseDto.incomeByChannel`. */
export type ApiPaymentChannel = 'WAVE' | 'ORANGE_MONEY' | 'CASH' | 'CHEQUE' | 'VIREMENT_BANCAIRE';

/** POST /api/v1/accounting/cash-sessions/close */
export interface CloseCashSessionRequestDto {
  physicalCountFcfa: number;
  gapJustification?: string;
}

/** Calqué sur `CashSessionResponse` (payment-service). */
export interface CashSessionResponseDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  cashierId: string;
  sessionDate: string; // ISO LocalDate (yyyy-MM-dd)
  status: ApiCashSessionStatus;
  /** `null` tant que la session est ouverte — calculé seulement à la clôture. */
  incomeByChannel: Partial<Record<ApiPaymentChannel, number>> | null;
  totalIncomesFcfa: number | null;
  totalExpensesFcfa: number | null;
  theoreticalBalance: number | null;
  physicalCountFcfa: number | null;
  gapFcfa: number | null;
  gapJustification: string | null;
  openedAt: string; // ISO LocalDateTime
  closedAt: string | null;
}

// ════════════════════════════════════════════════════════════════════════
// payment-service — LedgerController (/api/v1/accounting/ledger)
// ════════════════════════════════════════════════════════════════════════

/** Calqué sur `LedgerResponse` (payment-service). */
export interface LedgerResponseDto {
  schoolId: string;
  academicYearId: string;
  totalIncomesFcfa: number;
  totalExpensesFcfa: number;
  balanceFcfa: number;
  lastUpdatedAt: string | null; // ISO LocalDateTime
}

/** Calqué sur `LedgerHistoryPoint` (payment-service). */
export interface LedgerHistoryPointDto {
  period: string;
  incomesFcfa: number;
  expensesFcfa: number;
}

/** Calqué sur `LedgerHistoryResponse` (payment-service) -- GET .../ledger/history. */
export interface LedgerHistoryResponseDto {
  granularity: string;
  points: LedgerHistoryPointDto[];
  totalIncomesFcfa: number;
  totalExpensesFcfa: number;
  balanceFcfa: number;
}

// ════════════════════════════════════════════════════════════════════════
// payment-service — SalaryPaymentController (/api/v1/accounting/salary-requests)
// user-service — profil de rémunération (/api/v1/users/{id}/schools/{schoolId}/salary)
// ════════════════════════════════════════════════════════════════════════

/** Calqué sur `SalaryMode` (common-lib). */
export type ApiSalaryMode = 'FIXED' | 'PER_WORKED_DAY' | 'PER_HOUR';

/** Calqué sur `SalaryPaymentStatus` (payment-service). */
export type ApiSalaryPaymentStatus = 'DRAFT' | 'PENDING_VALIDATION' | 'VALIDATED' | 'REJECTED' | 'CANCELLED';

/** Calqué sur `PayoutStatus` (payment-service) — état du versement d'UNE ligne, distinct du statut de la demande. */
export type ApiPayoutStatus = 'PENDING' | 'PAID' | 'FAILED' | 'AWAITING_CASH_CONFIRMATION' | 'DISPUTED';

/**
 * Réponse de `GET`/`PUT /api/v1/users/{userId}/schools/{schoolId}/salary`
 * (user-service). `salaryMode` est `null` tant qu'aucun salaire n'a jamais
 * été configuré pour ce couple personnel/école.
 */
export interface SchoolSalaryProfileResponseDto {
  userId: string;
  schoolId: string;
  role: UserRole;
  salaryMode: ApiSalaryMode | null;
  fixedAmountFcfa: number | null;
  dailyRateFcfa: number | null;
  hourlyRateFcfa: number | null;
}

/** Une entrée de `CreateSalaryPaymentRequestDto.lines`. */
export interface SalaryLineInputDto {
  staffUserId: string;
  workedDays?: number;
  workedHours?: number;
  paymentMethod?: ApiPaymentChannel;
  payoutDestination?: string;
}

/** POST /api/v1/accounting/salary-requests */
export interface CreateSalaryPaymentRequestDto {
  schoolId: string;
  academicYearId: string;
  periodLabel: string; // "2026-10"
  periodStart: string; // ISO LocalDate (yyyy-MM-dd)
  periodEnd: string;
  lines: SalaryLineInputDto[];
}

/** POST /api/v1/accounting/salary-requests/{id}/validate */
export interface ValidateSalaryPaymentRequestDto {
  decision: ApiValidationDecision;
  comment?: string;
  /** Sous-ensemble de `staffUserId` à régler maintenant — absent = toutes les lignes. */
  selectedStaffUserIds?: string[];
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

/** GET /api/v1/accounting/salary-requests/payslips, GET .../payslips/{payslipId} */
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
  paymentMethod: ApiPaymentChannel | null;
  paymentReference: string | null;
  generatedBy: string;
  generatedAt: string | null; // ISO LocalDateTime -- CORRECTION (signalé) : absent si généré avant l'activation de l'auditing Mongo côté payment-service
}

// ── Portefeuille élève (WalletController, payment-service) ─────────────────

/** Traduit `WalletTransactionType` (payment-service). */
export type ApiWalletTransactionType =
  | 'SCHOLARSHIP_DISBURSEMENT'
  | 'RESTO_TICKET_PURCHASE'
  | 'MANUAL_CREDIT'
  | 'MANUAL_DEBIT'
  | 'REFUND';

/** GET /api/v1/payments/wallet/student/{studentId} */
export interface WalletResponseDto {
  studentId: string;
  schoolId: string;
  academicYearId: string;
  balanceFcfa: number;
  totalCreditedFcfa: number;
  totalDebitedFcfa: number;
  updatedAt: string | null; // ISO LocalDateTime
}

/** GET /api/v1/payments/wallet/student/{studentId}/transactions */
export interface WalletTransactionResponseDto {
  id: string;
  type: ApiWalletTransactionType;
  credit: boolean;
  amountFcfa: number;
  balanceAfterFcfa: number;
  note: string | null;
  relatedEntityId: string | null;
  createdAt: string; // ISO LocalDateTime
}

/** POST /api/v1/payments/wallet/student/{studentId}/credits */
export interface CreditWalletRequestDto {
  schoolId: string;
  academicYearId: string;
  amountFcfa: number;
  type: ApiWalletTransactionType;
  /** Obligatoire pour MANUAL_CREDIT côté backend. */
  note?: string;
  idempotencyKey: string;
}

/** POST /api/v1/payments/wallet/student/{studentId}/debits */
export interface DebitWalletRequestDto {
  schoolId: string;
  academicYearId: string;
  amountFcfa: number;
  note: string;
  idempotencyKey: string;
}

// ── Paiements élèves (PaymentController, payment-service) ──────────────────

/** Traduit `PaymentType` (payment-service). */
export type ApiPaymentType =
  | 'INSCRIPTION_ONLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'ANNUAL'
  | 'INSCRIPTION_MONTHLY'
  | 'INSCRIPTION_QUARTERLY'
  | 'INSCRIPTION_ANNUAL'
  | 'SCHOLARSHIP';

/** Traduit `TransactionStatus` (payment-service). */
export type ApiTransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'OVERDUE';

/** POST /api/v1/payments/cash */
export interface RecordCashRequestDto {
  schoolId: string;
  studentId: string;
  academicYearId: string;
  type: ApiPaymentType;
  amountFcfa: number;
  period?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  dueDate?: string; // ISO LocalDate
  note?: string;
}

/** GET /api/v1/payments/student/{studentId}, réponse de POST /cash */
export interface PaymentTransactionResponseDto {
  id: string;
  schoolId: string;
  studentId: string;
  academicYearId: string;
  type: ApiPaymentType;
  status: ApiTransactionStatus;
  amountFcfa: number;
  discountFcfa: number;
  netAmountFcfa: number;
  channel: ApiPaymentChannel;
  externalRef: string | null;
  period: string | null;
  installmentNumber: number;
  totalInstallments: number;
  deferred: boolean;
  dueDate: string | null; // ISO LocalDate
  paidDate: string | null;
  receiptS3Key: string | null;
  receiptUrl: string | null;
  scholarshipId: string | null;
  /** Solde de l'école juste avant / après ce paiement — non nul une fois COMPLETED. */
  balanceBeforeFcfa: number | null;
  balanceAfterFcfa: number | null;
  createdAt: string; // ISO LocalDateTime
}

// ── Tickets resto (RestoTicketController, payment-service) ─────────────────

/** Traduit `RestoTicketStatus` (payment-service). */
export type ApiRestoTicketStatus = 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';

/** GET /api/v1/payments/resto/tickets/student/{studentId} */
export interface RestoTicketPurchaseResponseDto {
  id: string;
  ticketTypeLabel: string;
  priceFcfa: number;
  purchaseCode: string;
  status: ApiRestoTicketStatus;
  purchasedAt: string; // ISO LocalDateTime
  expiresAt: string | null;
  redeemedAt: string | null;
}

// ── Bourses (ScholarshipController, payment-service) ────────────────────────

/** Traduit `ScholarshipStatus` (payment-service). */
export type ApiScholarshipStatus = 'PENDING_VALIDATION' | 'VALIDATED' | 'REJECTED' | 'ACTIVE' | 'SUSPENDED' | 'COMPLETED';

/** Traduit `ScholarshipPaymentStatus` (statut d'une tranche). */
export type ApiScholarshipPaymentStatus = 'EXPECTED' | 'PAID' | 'LATE' | 'PARTIAL' | 'PENDING';

/** Élément de `ScholarshipResponse.paymentSlices`. */
export interface ScholarshipPaymentSliceDto {
  id: string;
  expectedFcfa: number;
  dueDate: string; // ISO LocalDate
  paidFcfa: number;
  lastPaidDate: string | null;
  status: ApiScholarshipPaymentStatus;
  paymentProofUrl: string | null;
  note: string | null;
}

/** GET /api/v1/scholarships/student/{studentId}, /school/{schoolId}, /by-payer */
export interface ScholarshipResponseDto {
  id: string;
  schoolId: string;
  studentId: string;
  academicYearId: string;
  payerName: string;
  payerType: string;
  payerContact: string | null;
  payerReference: string | null;
  percentageCovered: number;
  totalAnnualFcfa: number;
  amountCoveredFcfa: number;
  studentRemainingFcfa: number;
  documentUrls: string[];
  status: ApiScholarshipStatus;
  validatedBy: string | null;
  validatedAt: string | null;
  rejectionReason: string | null;
  paymentSlices: ScholarshipPaymentSliceDto[];
  totalPaidByPayerFcfa: number;
  remainingToPayByPayerFcfa: number;
  payerProgressPercent: number;
  createdAt: string; // ISO LocalDateTime
  updatedAt: string;
}
