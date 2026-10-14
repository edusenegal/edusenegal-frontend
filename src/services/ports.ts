/**
 * Frontières entre l'interface et les données.
 *
 * Les écrans ne connaissent que ces interfaces. La branche `mock` les
 * implémente avec des données de démonstration en mémoire
 * (`src/services/mock/`) ; une future branche `api` les implémenterait avec
 * le client HTTP (`src/api/`, voir le README). Aucun composant ne change
 * d'une branche à l'autre.
 */

import type {
  AcademicYear,
  BulletinPeriod,
  ClassEvent,
  ClassGroup,
  DashboardSnapshot,
  DirectorProfile,
  LeaveRequest,
  Notice,
  NoticeDestType,
  PaymentConfig,
  SalaryRequest,
  SalarySlip,
  ScheduleSlot,
  School,
  SignedDocument,
  Student,
  Subject,
  SubjectCoefficient,
  Teacher,
  TransferRequest,
} from '@/types/domain';

export interface AuthPort {
  login(email: string, password: string): Promise<DirectorProfile>;
  logout(): Promise<void>;
  currentDirector(): Promise<DirectorProfile>;
}

/** Une classe à créer pour la nouvelle année — saisie à l'étape « Classes » de l'assistant. */
export interface OpenYearClassInput {
  level: ClassGroup['level'];
  series: string | null;
  tag: string | null;
  capacite: number;
}

/**
 * Coefficient d'une matière pour un couple niveau/série — saisi à l'étape
 * « Matières & coefficients ». Résolu en vraies classes (et vrais
 * `classeId`) au moment de l'ouverture : toutes les classes qui partagent ce
 * niveau/série (divisions A/B…) reçoivent le même coefficient.
 */
export interface OpenYearSubjectCoefInput {
  level: ClassGroup['level'];
  series: string | null;
  valeur: number;
  enseignee: boolean;
}

export interface OpenYearSubjectInput {
  code: string;
  nom: string;
  optionnelle: boolean;
  coefficients: OpenYearSubjectCoefInput[];
}

export interface OpenAcademicYearInput {
  label: string;
  dateDebut: string;
  dateFin: string;
  classes: OpenYearClassInput[];
  subjects: OpenYearSubjectInput[];
  paymentConfig: Omit<PaymentConfig, 'id' | 'updatedAt'>;
}

export interface SchoolPort {
  getSchool(): Promise<School>;
  updateBranding(patch: Partial<Pick<School, 'logoUrl' | 'brandColor'>>): Promise<School>;
  listAcademicYears(): Promise<AcademicYear[]>;
  /**
   * Ouverture d'une nouvelle année scolaire — un seul envoi pour tout
   * l'assistant (Classes → Matières & coefficients → Paiements), comme
   * l'assistant d'onboarding de référence. Backend réel
   * (year-opening-service orchestrant plusieurs services) :
   *  1. `POST /year-opening/years` — création (statut `DRAFT`)
   *  2. `POST /year-opening/periods` — découpage en trimestres ; cette
   *     page ne propose pas d'étape dédiée, des valeurs par défaut
   *     raisonnables (trimestres répartis entre `dateDebut`/`dateFin`,
   *     pondérations standard D1/D2/Composition) seraient envoyées ici
   *  3. `POST /classes` — une fois par classe de `classes`
   *  4. `PUT /subjects/{id}/coefficients` — une fois par matière, sur les
   *     classes nouvellement créées qui partagent son niveau/série, **et**
   *     `POST /year-opening/subjects` pour satisfaire la checklist de
   *     complétude de l'année (ce sont deux registres distincts côté
   *     backend : le premier sert aux bulletins, le second ne fait que
   *     conditionner l'ouverture)
   *  5. `POST /payments/config` — `paymentConfig`
   *  6. `POST /year-opening/enrollment` — fenêtre d'inscription ; pas
   *     d'étape dédiée non plus ici, valeurs par défaut (ouverte dès
   *     `dateDebut`)
   *  7. `POST /year-opening/open` — n'aboutit, côté vrai backend, que si
   *     les 5 points de la checklist ci-dessus sont réunis (classes,
   *     matières, paiements, périodes, inscriptions) ; les valeurs par
   *     défaut des points 2 et 6 existent précisément pour que cet appel
   *     réussisse malgré l'absence d'écran dédié pour ces deux points.
   */
  openAcademicYear(input: OpenAcademicYearInput): Promise<AcademicYear>;
  /** Clôture explicite — backend : `POST /year-opening/years/{yearId}/close`. */
  closeAcademicYear(yearId: string): Promise<AcademicYear>;
}

export interface DashboardPort {
  getSnapshot(): Promise<DashboardSnapshot>;
}

export interface ClassesPort {
  list(): Promise<ClassGroup[]>;
  get(classId: string): Promise<ClassGroup>;
  create(input: {
    level: ClassGroup['level'];
    series: string | null;
    tag: string | null;
    capacite: number;
    homeroomTeacherId?: string | null;
  }): Promise<ClassGroup>;
  /** Backend : `PUT /classes/{classId}/homeroom-teacher/{teacherId}`. `null` retire le professeur principal. */
  setHomeroomTeacher(classId: string, teacherId: string | null): Promise<ClassGroup>;
  listEvents(classId: string): Promise<ClassEvent[]>;
  planEvent(input: Omit<ClassEvent, 'id'>): Promise<ClassEvent>;
  getWeeklySchedule(classId: string): Promise<ScheduleSlot[]>;
}

export interface TeachersPort {
  list(): Promise<Teacher[]>;
  get(teacherId: string): Promise<Teacher>;
  create(input: Omit<Teacher, 'id' | 'classes' | 'statut'>): Promise<Teacher>;
  update(teacherId: string, patch: Partial<Pick<Teacher, 'nom' | 'matiere' | 'tel' | 'email'>>): Promise<Teacher>;
  remove(teacherId: string): Promise<void>;
  addClass(teacherId: string, className: string): Promise<Teacher>;
  removeClass(teacherId: string, className: string): Promise<Teacher>;
  listDocuments(teacherId: string): Promise<SignedDocument[]>;
  listPayslips(teacherId: string): Promise<SalarySlip[]>;
}

export interface StudentsPort {
  list(classId?: string): Promise<Student[]>;
  get(studentId: string): Promise<Student>;
  create(input: {
    prenom: string;
    nom: string;
    sexe: Student['sexe'];
    classeId: string;
    dateNaissance: string;
    tel: string;
    parent: string;
  }): Promise<Student>;
  update(studentId: string, patch: Partial<Student>): Promise<Student>;
  /** Backend : `DELETE /users/{id}`. */
  remove(studentId: string): Promise<void>;
}

export interface SubjectsPort {
  list(): Promise<Subject[]>;
  get(subjectId: string): Promise<Subject>;
  /** Backend : `POST /subjects` — matière propre à l'établissement (`schoolId` renseigné, `global: false`). */
  create(input: { code: string; nom: string; optionnelle: boolean }): Promise<Subject>;
  /** Backend : `PUT /subjects/{subjectId}/coefficients` — remplace la liste complète des coefficients. */
  setCoefficients(subjectId: string, coefficients: SubjectCoefficient[]): Promise<Subject>;
  /** Backend : `DELETE /subjects/{subjectId}`. Réservé aux matières de l'établissement — le catalogue global ne se supprime pas depuis cet écran. */
  remove(subjectId: string): Promise<void>;
}

export interface PaymentConfigPort {
  /** Backend : `GET /payments/config/{schoolId}`. `null` tant qu'aucune configuration n'a été enregistrée (404 côté backend). */
  get(): Promise<PaymentConfig | null>;
  /** Backend : `POST /payments/config` — upsert, une seule configuration par établissement. */
  save(input: Omit<PaymentConfig, 'id' | 'updatedAt'>): Promise<PaymentConfig>;
}

export interface PromotionsPort {
  promoteClass(fromClassId: string, toClassId: string): Promise<{ moved: number }>;
  promoteStudent(studentId: string, toClassId: string): Promise<void>;
}

export interface TransfersPort {
  list(): Promise<TransferRequest[]>;
  requestInternal(studentId: string, toClassId: string): Promise<TransferRequest>;
  requestExternal(studentId: string, region: string, schoolName: string): Promise<TransferRequest>;
}

export interface LeavesPort {
  list(): Promise<LeaveRequest[]>;
  review(leaveId: string, approve: boolean): Promise<LeaveRequest>;
}

export interface SalaryRequestsPort {
  list(): Promise<SalaryRequest[]>;
  create(teacherId: string, mois: string): Promise<SalaryRequest>;
  createBulk(teacherIds: string[], mois: string): Promise<SalaryRequest[]>;
}

export interface SignaturesPort {
  listDocuments(): Promise<SignedDocument[]>;
  listBulletinPeriods(): Promise<BulletinPeriod[]>;
  signForStudent(studentId: string, type: string, period: BulletinPeriod['key'] | null): Promise<SignedDocument>;
  signForStaff(staffId: string, type: string): Promise<SignedDocument>;
  signBulk(classId: string, period: BulletinPeriod['key']): Promise<{ signed: number }>;
  importToSign(targetKind: 'eleve' | 'personnel', targetId: string, fileName: string): Promise<SignedDocument>;
}

export interface NoticesPort {
  list(): Promise<Notice[]>;
  create(input: {
    titre: string;
    corps: string;
    destType: NoticeDestType;
    destLabel: string;
    date: string;
  }): Promise<Notice>;
}

/** Point d'assemblage unique — c'est le seul objet que changerait une branche `api`. */
export interface Services {
  auth: AuthPort;
  school: SchoolPort;
  dashboard: DashboardPort;
  classes: ClassesPort;
  teachers: TeachersPort;
  students: StudentsPort;
  subjects: SubjectsPort;
  paymentConfig: PaymentConfigPort;
  promotions: PromotionsPort;
  transfers: TransfersPort;
  leaves: LeavesPort;
  salaryRequests: SalaryRequestsPort;
  signatures: SignaturesPort;
  notices: NoticesPort;
}
