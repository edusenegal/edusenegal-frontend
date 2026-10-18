/**
 * Frontières entre l'interface et les données — espace enseignant.
 *
 * Les écrans ne connaissent que ces interfaces ; `src/api/*.api.ts` les
 * implémente contre le backend réel (voir le README, section "Architecture").
 */

import type {
  AppNotification,
  AssessmentType,
  AttendanceStudentEntry,
  Complaint,
  ComplaintType,
  CourseDocument,
  CourseDocumentType,
  DiscussionGroup,
  ExamEvent,
  ExamType,
  GenerateQuizInput,
  Grade,
  GradeDispute,
  GradeDisputeDecisionInput,
  GroupMessage,
  LeaveRequest,
  MessageKind,
  MyClass,
  PersonalDocument,
  PersonalDocumentOwnerType,
  PersonalDocumentType,
  Quiz,
  RequestLeaveInput,
  SalarySlip,
  School,
  SemesterResult,
  StudentRosterEntry,
  Subject,
  TeacherProfile,
  TimetableSlot,
} from '@/types/domain';

export interface AuthPort {
  /**
   * `loginByPhone` dit à la passerelle si `identifier` est un numéro de
   * téléphone ou un matricule école — l'écran de connexion expose ce choix
   * explicitement, voir `LoginPage`.
   */
  login(identifier: string, password: string, loginByPhone: boolean): Promise<TeacherProfile>;
  logout(): Promise<void>;
  currentTeacher(): Promise<TeacherProfile>;
  changePassword(newPassword: string): Promise<void>;
}

/** Lecture seule — l'enseignant ne modifie ni le branding ni l'année scolaire. */
export interface SchoolPort {
  getSchool(): Promise<School>;
}

/** Matières enseignées par le professeur connecté — résolu depuis son profil. */
export interface SubjectsPort {
  listMine(): Promise<Subject[]>;
}

export interface MyClassesPort {
  /** Classes où le professeur connecté enseigne (principal ou itinérant). */
  list(): Promise<MyClass[]>;
  /** Roster d'une classe — ids résolus en noms via `GET /users/{id}` (voir `myClasses.api.ts`). */
  roster(classId: string): Promise<StudentRosterEntry[]>;
}

export interface TimetablePort {
  /** Emploi du temps hebdomadaire du professeur connecté, toutes classes confondues. */
  mine(): Promise<TimetableSlot[]>;
}

export interface GradesPort {
  /** Notes d'une classe pour une matière/semestre. */
  listForClass(classId: string, subjectId: string, semesterNumber: number): Promise<Grade[]>;
  enter(input: {
    classId: string;
    studentId: string;
    subjectId: string;
    semestre: number;
    type: AssessmentType;
    session: 1 | 2;
    valeur: number;
    coefficient: number;
    commentaire?: string;
  }): Promise<Grade>;
  /** Saisie en masse pour toute une classe — une valeur par élève, même type/coefficient. */
  enterBulk(input: {
    classId: string;
    subjectId: string;
    semestre: number;
    type: AssessmentType;
    session: 1 | 2;
    coefficient: number;
    entries: { studentId: string; valeur: number; commentaire?: string; absent: boolean }[];
  }): Promise<{ requested: number; saved: number; updated: number; failed: number }>;
  update(gradeId: string, valeur: number, commentaire?: string): Promise<Grade>;
}

export interface GradeDisputesPort {
  /** Réclamations en attente d'une décision du professeur connecté (niveau 1). */
  listPending(): Promise<GradeDispute[]>;
  decide(disputeId: string, decision: GradeDisputeDecisionInput): Promise<GradeDispute>;
}

export interface ResultsPort {
  /** `null` si les moyennes de ce semestre ne sont pas encore disponibles. */
  getStudentSemesterResult(studentId: string, semesterNumber: number): Promise<SemesterResult | null>;
  /** Télécharge le PDF du bulletin (déclenche l'enregistrement local). */
  downloadBulletinPdf(studentId: string, semesterNumber: number): Promise<void>;
}

export interface AttendancePort {
  mark(input: {
    classId: string;
    subjectId: string;
    date: string; // yyyy-mm-dd
    period: string;
    eleves: AttendanceStudentEntry[];
  }): Promise<void>;
  /** Feuille d'appel déjà saisie pour une classe à une date donnée — `null` si rien n'a encore été saisi. */
  getSheet(classId: string, subjectId: string, date: string): Promise<{
    totalStudents: number;
    present: number;
    absent: number;
    attendanceRate: number;
    students: AttendanceStudentEntry[];
  } | null>;
}

/**
 * Documents pédagogiques d'une matière (cours, exercices, corrigés, sujets
 * d'examen, ressources). Backend : `document-service`, `/api/v1/documents`.
 */
export interface CourseDocumentsPort {
  list(subjectId: string): Promise<CourseDocument[]>;
  upload(input: {
    subjectId: string;
    classId?: string;
    type: CourseDocumentType;
    titre: string;
    description?: string;
    file: File;
  }): Promise<CourseDocument>;
  remove(documentId: string): Promise<void>;
}

/**
 * Pièces personnelles de l'enseignant connecté (CNI, diplôme,
 * certification). Backend : `document-service`, `/api/v1/personal-documents`.
 */
export interface PersonalDocumentsPort {
  list(ownerId: string, ownerType: PersonalDocumentOwnerType): Promise<PersonalDocument[]>;
  upload(input: {
    ownerId: string;
    ownerType: PersonalDocumentOwnerType;
    type: PersonalDocumentType;
    titre: string;
    description?: string;
    file: File;
  }): Promise<PersonalDocument>;
  remove(documentId: string): Promise<void>;
}

export interface ExamsPort {
  listForClass(classId: string): Promise<ExamEvent[]>;
  schedule(input: {
    classId: string;
    subjectId: string;
    titre: string;
    type: ExamType;
    semestre: number;
    date: string; // yyyy-mm-dd
    heureDebut: string;
    heureFin: string;
    salle?: string;
  }): Promise<ExamEvent>;
  remove(examId: string): Promise<void>;
}

export interface LeavesPort {
  /** Congés du professeur connecté. */
  mine(): Promise<LeaveRequest[]>;
  request(input: RequestLeaveInput): Promise<LeaveRequest>;
}

/** Bulletins de salaire — lecture seule, voir `apps/director`. */
export interface PayslipsPort {
  mine(): Promise<SalarySlip[]>;
}

export interface QuizPort {
  mine(): Promise<Quiz[]>;
  generate(input: GenerateQuizInput): Promise<Quiz>;
  publish(quizId: string): Promise<Quiz>;
  unpublish(quizId: string): Promise<Quiz>;
  remove(quizId: string): Promise<void>;
}

export interface MessagingPort {
  myGroups(): Promise<DiscussionGroup[]>;
  messages(groupId: string, page?: number, size?: number): Promise<GroupMessage[]>;
  send(groupId: string, input: { contenu?: string; type: MessageKind; fichier?: File }): Promise<GroupMessage>;
  markRead(groupId: string): Promise<void>;
}

export interface NotificationsPort {
  mine(page?: number, size?: number): Promise<AppNotification[]>;
  unreadCount(): Promise<number>;
  markRead(notificationId: string): Promise<void>;
  markAllRead(): Promise<void>;
}

export interface ComplaintsPort {
  mine(): Promise<Complaint[]>;
  create(input: { type: ComplaintType; sujet: string; description: string; anonyme?: boolean }): Promise<Complaint>;
}

export interface Services {
  auth: AuthPort;
  school: SchoolPort;
  subjects: SubjectsPort;
  myClasses: MyClassesPort;
  timetable: TimetablePort;
  grades: GradesPort;
  gradeDisputes: GradeDisputesPort;
  results: ResultsPort;
  attendance: AttendancePort;
  courseDocuments: CourseDocumentsPort;
  personalDocuments: PersonalDocumentsPort;
  exams: ExamsPort;
  leaves: LeavesPort;
  payslips: PayslipsPort;
  quiz: QuizPort;
  messaging: MessagingPort;
  notifications: NotificationsPort;
  complaints: ComplaintsPort;
}
