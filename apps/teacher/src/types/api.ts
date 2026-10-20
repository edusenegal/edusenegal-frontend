/**
 * Transcription fidèle des DTO du backend EduSénégal consommés par l'espace
 * enseignant. Ces types ne remontent jamais jusqu'aux écrans — traduits par
 * la couche service (`src/api/*.api.ts`) vers `types/domain.ts`. Même
 * convention que `apps/director`/`apps/comptable` (voir leur README).
 */

/** Calqué sur `common-lib` `UserRole` — tous les rôles existent côté jeton, seuls deux nous concernent. */
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

/** Calqué sur `UserServiceImpl` — `ApiSexe`. */
export type ApiSexe = 'MASCULIN' | 'FEMININ';

// ════════════════════════════════════════════════════════════════════════
// auth — api-gateway / user-service
// ════════════════════════════════════════════════════════════════════════

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

/** Réponse de /auth/login et /auth/refresh. */
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
  classId?: string;
  schools?: string[];
  mustChangePassword: boolean;
}

/** GET /api/v1/users/{userId} */
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
  activeSchoolId?: string;
  schoolIndicatif?: string;
  sexe?: ApiSexe;
  birthDate?: string;
  address?: string;
  photoUrl?: string;
  /** Enseignant uniquement — ids de matière (subject-service), pas des noms. */
  subjectIds?: string[];
}

/** PUT /api/v1/users/{userId}/change-password */
export interface ChangePasswordRequestDto {
  newPassword: string;
}

/** Corps d'erreur renvoyé par la passerelle. */
export interface ApiErrorDto {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
}

// ════════════════════════════════════════════════════════════════════════
// school-service
// ════════════════════════════════════════════════════════════════════════

/** GET /api/v1/schools/{schoolId}/academic-years/active */
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
 * `teacherIds` mêle professeur principal + itinérants.
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

/** GET /api/v1/subjects/{id}, GET /api/v1/subjects/school/{schoolId}/global */
/** Une entrée de coefficient par classe — `subject-service`, voir `UpdateCoefficientsRequestDto`. */
export interface CoefficientEntryDto {
  classId: string;
  level?: string | null;
  series?: string | null;
  tag?: string | null;
  value: number;
  active: boolean;
}

export interface SubjectResponseDto {
  id: string;
  schoolId: string | null;
  global: boolean;
  code: string;
  names: Record<string, string>;
  schoolTypeScope: ApiSchoolType;
  optional: boolean;
  coefficients: CoefficientEntryDto[];
}

// ════════════════════════════════════════════════════════════════════════
// academic-service — notes, réclamations, résultats
// ════════════════════════════════════════════════════════════════════════

/** Calqué sur `common-lib` `AssessmentType`. */
export type ApiAssessmentType =
  | 'DEVOIR1'
  | 'DEVOIR2'
  | 'COMPOSITION'
  | 'INTERRO'
  | 'TP'
  | 'TD'
  | 'DEVOIR'
  | 'CONTROLE_CONTINU'
  | 'EXAMEN'
  | 'PROJET'
  | 'EXPOSE'
  | 'STAGE';

/** GradeResponse (academic-service). */
export interface GradeResponseDto {
  id: string;
  studentId: string;
  subjectId: string;
  subjectName: string | null;
  teacherId: string;
  semesterNumber: number;
  type: ApiAssessmentType;
  session: number;
  value: number;
  coefficient: number;
  comment: string | null;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GradeHistoryResponse (academic-service) — GET /api/v1/academic/grades/{gradeId}/history */
export interface GradeHistoryResponseDto {
  id: string;
  gradeId: string;
  action: 'ENTERED' | 'UPDATED';
  oldValue: number | null;
  newValue: number;
  oldComment: string | null;
  newComment: string | null;
  actorId: string;
  actorName: string | null;
  at: string;
}

/** POST /api/v1/academic/grades */
export interface EnterGradeRequestDto {
  schoolId: string;
  academicYearId: string;
  classId: string;
  studentId: string;
  subjectId: string;
  semesterNumber: number;
  type: ApiAssessmentType;
  session: number;
  value: number;
  coefficient: number;
  comment?: string;
}

/** POST /api/v1/academic/grades/bulk — une entrée élève. */
export interface BulkEnterGradesStudentEntryDto {
  studentId: string;
  value: number;
  comment?: string;
  /** Si `true`, `value` vaut 0 avec le marqueur absent côté backend. */
  absent: boolean;
}

/** POST /api/v1/academic/grades/bulk */
export interface BulkEnterGradesRequestDto {
  schoolId: string;
  academicYearId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  semesterNumber: number;
  type: ApiAssessmentType;
  session: number;
  coefficient: number;
  entries: BulkEnterGradesStudentEntryDto[];
}

/** Réponse de POST /api/v1/academic/grades/bulk. */
export interface BulkGradeResultDto {
  requested: number;
  saved: number;
  updated: number;
  failed: number;
  failedStudentIds: string[];
}

/** Calqué sur `GradeDisputeStatus` (academic-service). */
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

/** GradeDisputeResponse (academic-service). */
export interface GradeDisputeResponseDto {
  id: string;
  schoolId: string;
  academicYearId: string;
  gradeId: string;
  studentId: string;
  classId: string;
  subjectId: string;
  subjectName: string | null;
  /** Type d'évaluation de la note contestée — résolu depuis la note au moment de la lecture, peut être absent si la note a disparu. */
  type?: ApiAssessmentType | null;
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

/** PUT /api/v1/academic/grade-disputes/{disputeId}/teacher-decision */
export interface TeacherDisputeDecisionRequestDto {
  approved: boolean;
  newValue?: number;
  comment?: string;
}

/** Calqué sur `Mention` (academic-service). */
export type ApiMention = 'EXCELLENT' | 'TRES_BIEN' | 'BIEN' | 'ASSEZ_BIEN' | 'PASSABLE' | 'INSUFFISANT';

/** Imbriqué dans `SemesterResultResponseDto.subjects`. */
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

/** GET /api/v1/academic/results/student/{studentId}/semester/{semester} */
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

// ════════════════════════════════════════════════════════════════════════
// attendance-service
// ════════════════════════════════════════════════════════════════════════

export type ApiAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';

export interface StudentAttendanceDto {
  studentId: string;
  status: ApiAttendanceStatus;
  note?: string | null;
  parentNotified?: boolean;
}

/** POST /api/v1/attendances/mark */
export interface MarkAttendanceRequestDto {
  schoolId: string;
  classId: string;
  academicYearId: string;
  subjectId: string;
  /** ISO yyyy-MM-dd */
  date: string;
  /** `MON`..`SUN` en majuscules anglaises côté Java `DayOfWeek`. */
  dayOfWeek: string;
  period: string;
  students: StudentAttendanceDto[];
}

/** Réponse de POST /api/v1/attendances/mark (AttendanceRecord, attendance-service). */
export interface AttendanceRecordDto {
  id: string;
  schoolId: string;
  classId: string;
  academicYearId: string;
  subjectId: string;
  teacherId: string;
  date: string;
  dayOfWeek: string;
  period: string;
  records: StudentAttendanceDto[];
  syncStatus: 'SYNCED' | 'PENDING_SYNC';
  createdAt: string;
  updatedAt: string;
}

export interface StudentAttendanceViewDto {
  studentId: string;
  status: ApiAttendanceStatus;
  note: string | null;
}

/** GET /api/v1/attendances/analytics/class/sheet(/range) */
export interface AttendanceSheetResponseDto {
  schoolId: string;
  classId: string;
  subjectId: string;
  date: string;
  totalStudents: number;
  present: number;
  absent: number;
  attendanceRate: number;
  students: StudentAttendanceViewDto[];
}

// ════════════════════════════════════════════════════════════════════════
// document-service
// ════════════════════════════════════════════════════════════════════════

/** Calqué sur `document-service` `DocumentType`. */
export type ApiCourseDocumentType = 'COURSE' | 'EXERCISE' | 'CORRECTION' | 'EXAM_SUBJECT' | 'RESOURCE' | 'OTHER';

/** DocumentResponse (document-service) — document pédagogique. */
export interface DocumentResponseDto {
  id: string;
  schoolId: string;
  classId: string | null;
  subjectId: string;
  subjectName: string | null;
  timetableSlotId?: string | null;
  uploadedByTeacherId: string;
  title: string;
  description: string | null;
  downloadUrl: string;
  contentUrl: string;
  fileType: string;
  fileSizeBytes: number;
  type: ApiCourseDocumentType;
  createdAt: string;
}

/** Partie `data` (JSON) du multipart POST /api/v1/documents. */
export interface UploadDocumentRequestDto {
  schoolId?: string;
  classId?: string;
  subjectId?: string;
  /** Rattache le dépôt à un créneau précis de l'emploi du temps — voir `SlotDetailSheet`. */
  timetableSlotId?: string;
  type: ApiCourseDocumentType;
  title: string;
  description?: string;
}

/** Calqué sur `document-service` `PersonalDocumentType`. */
export type ApiPersonalDocumentType = 'CNI' | 'DIPLOMA' | 'CERTIFICATION' | 'BIRTH_CERTIFICATE' | 'PARENT_CNI' | 'OTHER';

/** Calqué sur `document-service` `PersonalDocumentOwnerType`. */
export type ApiPersonalDocumentOwnerType = 'STAFF' | 'STUDENT';

/** Partie `data` (JSON) du multipart POST /api/v1/personal-documents. */
export interface UploadPersonalDocumentRequestDto {
  schoolId?: string;
  ownerUserId: string;
  ownerType: ApiPersonalDocumentOwnerType;
  type: ApiPersonalDocumentType;
  academicYearId?: string;
  title: string;
  description?: string;
}

/** PersonalDocumentResponse (document-service). */
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

// ════════════════════════════════════════════════════════════════════════
// schedule-service — examens, emploi du temps, congés
// ════════════════════════════════════════════════════════════════════════

export type ApiExamType = 'DEVOIR1' | 'DEVOIR2' | 'COMPOSITION' | 'INTERRO' | 'EXAMEN_BLANC' | 'CONSEIL_DE_CLASSE';

/** ExamCalendarResponse (schedule-service). */
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

/** Jour de semaine côté backend — `MON`..`SAT`. */
export type ApiDayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

// ── Salles de classe (schedule-service, ClassRoomController) ──

/** ClassRoomResponse. */
export interface ClassRoomDto {
  id: string;
  schoolId: string;
  name: string;
  capacity: number;
  classId?: string | null;
}

/** RoomAvailabilityResponse — GET /api/v1/rooms/availability */
export interface RoomAvailabilityResponseDto {
  roomId: string;
  roomName: string;
  capacity: number;
  available: boolean;
  conflictReason: string | null;
}

/** TimetableSlotResponse (schedule-service). */
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
  description?: string | null;
  grayedOut: boolean;
  weekNumber: number;
  createdAt?: string;
}

/** Calqué sur `LeaveStatus` (schedule-service). */
export type ApiLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** LeaveRequestResponse (schedule-service). */
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

// ════════════════════════════════════════════════════════════════════════
// payment-service — bulletin de salaire (lecture seule, « Ma fiche de paie »)
// ════════════════════════════════════════════════════════════════════════

export type ApiSalaryMode = 'FIXED' | 'PER_WORKED_DAY' | 'PER_HOUR';

/** GET /api/v1/accounting/salary-requests/payslips/me */
/** Avis de paiement en espèces en attente de confirmation — `CashPaymentNoticeResponse` (payment-service). */
export interface CashPaymentNoticeResponseDto {
  requestId: string;
  staffUserId: string;
  periodLabel: string;
  amountFcfa: number;
  validatedAt?: string;
}

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
   * CORRECTION (signalé) -- `@CreatedDate` sans Mongo auditing actif côté
   * payment-service laissait ce champ absent du JSON (voir `fromPayslipResponse`) ;
   * nullable tant que les bulletins générés avant ce correctif n'ont pas été
   * recrées.
   */
  generatedAt: string | null;
}

// ════════════════════════════════════════════════════════════════════════
// ai-service — quiz de révision
// ════════════════════════════════════════════════════════════════════════

export type ApiGenerationStatus = 'PENDING' | 'READY' | 'FAILED';

export interface QuizQuestionDto {
  index: number;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string | null;
}

/** POST /api/v1/ai/quiz/generate */
export interface GenerateQuizRequestDto {
  schoolId?: string;
  subjectName: string;
  classId?: string;
  subjectId?: string;
  courseText?: string;
  topic?: string;
  questionCount: number;
  language?: string;
}

/** QuizResponse — vue ENSEIGNANT (avec réponses). */
export interface QuizResponseDto {
  id: string;
  title: string;
  classId: string | null;
  subjectId: string | null;
  subjectName: string | null;
  questionCount: number;
  questions: QuizQuestionDto[];
  published: boolean;
  generationStatus: ApiGenerationStatus;
  failureReason: string | null;
  attemptCount: number;
  createdAt: string;
}

// ════════════════════════════════════════════════════════════════════════
// messaging-service — groupes de discussion
// ════════════════════════════════════════════════════════════════════════

export type ApiGroupType = 'CLASS_GROUP' | 'STAFF_DIRECTOR' | 'PARENT_TEACHER' | 'CUSTOM';

/** DiscussionGroupResponse (messaging-service). */
export interface DiscussionGroupResponseDto {
  id: string;
  schoolId: string;
  type: ApiGroupType;
  classId: string | null;
  name: string;
  creatorId: string;
  memberIds: string[];
  adminIds: string[];
  isModerated: boolean;
  archived: boolean;
  lastMessageAt: string | null;
  createdAt: string;
  unreadCount: number;
  memberCount: number;
  admin: boolean;
}

export type ApiMessageType = 'TEXT' | 'FILE' | 'ANNOUNCEMENT';

/** MessageResponse (messaging-service). */
export interface MessageResponseDto {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: ApiMessageType;
  fileUrl: string | null;
  fileName: string | null;
  fileSizeBytes: number;
  readBy: string[];
  deleted: boolean;
  sentAt: string;
}

// ════════════════════════════════════════════════════════════════════════
// notification-service
// ════════════════════════════════════════════════════════════════════════

/** NotificationResponse (notification-service) — champs utiles seulement. */
export interface NotificationResponseDto {
  id: string;
  schoolId: string;
  recipientId: string;
  type: string;
  channel: string;
  title: string;
  body: string;
  sent: boolean;
  read: boolean;
  sentAt: string | null;
  createdAt: string;
}

// ════════════════════════════════════════════════════════════════════════
// complaint-service
// ════════════════════════════════════════════════════════════════════════

export type ApiComplaintType =
  | 'TEACHER_COMPLAINT'
  | 'GRADE_COMPLAINT'
  | 'SCHEDULE_COMPLAINT'
  | 'FACILITY_COMPLAINT'
  | 'ADMINISTRATIVE_COMPLAINT'
  | 'SUGGESTION'
  | 'OTHER';

export type ApiComplaintStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED' | 'ARCHIVED';

/** POST /api/v1/complaints */
export interface CreateComplaintRequestDto {
  schoolId: string;
  type: ApiComplaintType;
  targetUserId?: string;
  subject: string;
  description: string;
  attachmentUrl?: string;
  isAnonymous: boolean;
  isConfidential: boolean;
}

/** ComplaintResponse (complaint-service). */
export interface ComplaintResponseDto {
  id: string;
  schoolId: string;
  submittedByUserId: string;
  submittedByName: string;
  targetUserId: string | null;
  targetName: string | null;
  type: ApiComplaintType;
  status: ApiComplaintStatus;
  subject: string;
  description: string;
  attachmentUrl: string | null;
  resolvedBy: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  isAnonymous: boolean;
  createdAt: string;
}
