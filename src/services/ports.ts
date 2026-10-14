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
  AcademicPeriod,
  AcademicPeriodType,
  AcademicYear,
  AcademicYearConfig,
  BulletinPeriod,
  ClassEvent,
  ClassGroup,
  CourseDocument,
  CourseDocumentType,
  DashboardSnapshot,
  DirectorProfile,
  LeaveRequest,
  Notice,
  NoticeDestType,
  PaymentChannel,
  PaymentConfig,
  PersonalDocument,
  PersonalDocumentOwnerType,
  PersonalDocumentType,
  SalaryMode,
  SalaryRequest,
  SalarySlip,
  ScheduleSlot,
  School,
  SemesterResult,
  SignedDocument,
  StaffAbsence,
  StaffAbsenceSummary,
  Student,
  Subject,
  SubjectCoefficient,
  Teacher,
  TeacherLookupResult,
  TransferRequest,
  YearResult,
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
  /**
   * La rémunération ne se saisit pas à la création — un enseignant nouvellement
   * créé n'a aucun salaire configuré côté backend (`SchoolSalaryProfileResponse`
   * n'existe qu'après un premier appel à `updateSalary`) ; c'est un acte distinct,
   * volontaire, depuis la fiche de l'enseignant.
   */
  create(input: Omit<Teacher, 'id' | 'classes' | 'statut' | 'salaryMode' | 'salaireFixe' | 'tauxJournalier' | 'tauxHoraire'>): Promise<Teacher>;
  /**
   * Recherche par téléphone — étape obligatoire AVANT de créer un nouvel
   * enseignant : évite un doublon si la personne existe déjà (potentiellement
   * rattachée à une autre école). `null` si aucun utilisateur ne porte ce
   * numéro. Backend : `GET /api/v1/users/by-phone/{phone}` (user-service).
   */
  findByPhone(tel: string): Promise<TeacherLookupResult | null>;
  /**
   * Rattache un utilisateur EXISTANT (trouvé par téléphone) à cet
   * établissement, sans salaire — la direction configure ensuite sa
   * rémunération comme pour un enseignant nouvellement créé.
   * Backend : `POST /api/v1/users/{userId}/schools` (user-service).
   */
  attachExisting(userId: string, matiere: string): Promise<Teacher>;
  update(teacherId: string, patch: Partial<Pick<Teacher, 'nom' | 'matiere' | 'tel' | 'email'>>): Promise<Teacher>;
  /** Backend : `DELETE /users/{id}`. */
  remove(teacherId: string): Promise<void>;
  addClass(teacherId: string, className: string): Promise<Teacher>;
  removeClass(teacherId: string, className: string): Promise<Teacher>;
  listDocuments(teacherId: string): Promise<SignedDocument[]>;
  /** Backend : `GET /api/v1/accounting/salary-requests/payslips?schoolId&staffUserId` (payment-service). */
  listPayslips(teacherId: string): Promise<SalarySlip[]>;
  /**
   * Configure le mode et le montant de salaire de cet enseignant pour
   * l'établissement du directeur connecté — un seul des trois montants est
   * pertinent selon `salaryMode` (validé côté serveur, pas ici, pour un
   * message métier clair plutôt qu'une erreur de validation générique).
   * Backend : `PUT /api/v1/users/{userId}/schools/{schoolId}/salary` (user-service).
   */
  updateSalary(
    teacherId: string,
    input: { salaryMode: SalaryMode; salaireFixe: number | null; tauxJournalier: number | null; tauxHoraire: number | null },
  ): Promise<Teacher>;
}

/**
 * Absences du personnel enseignant, saisies par la direction — distinct de
 * l'appel fait par un enseignant sur ses élèves (hors scope de cette
 * application). Alimente le calcul d'une `SalaryRequest` en mode "par jour".
 */
export interface StaffAbsencesPort {
  /** Backend : `GET /api/v1/staff-absences?schoolId&staffUserId` (attendance-service). */
  list(teacherId: string): Promise<StaffAbsence[]>;
  /** Backend : `POST /api/v1/staff-absences`. */
  record(
    teacherId: string,
    input: { dateDebut: string; dateFin: string; justifiee: boolean; motif: string | null },
  ): Promise<StaffAbsence>;
  /** Backend : `DELETE /api/v1/staff-absences/{absenceId}`. */
  remove(absenceId: string): Promise<void>;
  /** Backend : `GET /api/v1/staff-absences/summary?schoolId&staffUserId&from&to`. */
  getSummary(teacherId: string, dateDebut: string, dateFin: string): Promise<StaffAbsenceSummary>;
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

/**
 * Demandes de paiement de salaire — traduit `SalaryPaymentController`
 * (payment-service). Mêmes rôles que les dépenses : la création/soumission
 * comme la décision finale reviennent indifféremment au directeur ou au
 * comptable selon le circuit de l'école ; cette application ne propose que
 * le rôle directeur, qui peut donc enchaîner les quatre étapes lui-même.
 */
/**
 * Côté frontend/director : CRÉATION et SOUMISSION seulement — la validation
 * (vérification du solde, choix du mode de règlement effectif, cashout
 * mobile money, confirmation de réception cash) revient au COMPTABLE
 * (`POST .../{id}/validate`, en attente de son propre frontend, à venir).
 * Volontairement absent de ce port : l'exposer ici inviterait le directeur à
 * déclencher un paiement réel sans l'écran de contrôle de solde que ce
 * endpoint suppose désormais côté comptable.
 */
export interface SalaryRequestsPort {
  /** Backend : `GET /api/v1/accounting/salary-requests?schoolId&academicYearId`. */
  list(): Promise<SalaryRequest[]>;
  /**
   * Crée une demande en statut brouillon — une ligne par enseignant choisi,
   * avec le mode de règlement souhaité. Le montant de chaque ligne est
   * calculé côté serveur à partir de son profil de salaire et, en mode "par
   * jour", de ses absences non justifiées sur la période ; jamais saisi ici.
   * Backend : `POST /api/v1/accounting/salary-requests`.
   */
  create(input: {
    periode: string;
    dateDebut: string;
    dateFin: string;
    lignes: {
      teacherId: string;
      joursTravailles?: number;
      heuresTravaillees?: number;
      /** cash par défaut si omis (voir `SalaryLineInput.paymentMethod` côté backend). */
      modePaiement?: PaymentChannel;
      /** Numéro de téléphone pour wave/orange_money — celui du personnel par défaut si omis. */
      destinationPaiement?: string;
    }[];
  }): Promise<SalaryRequest>;
  /** Backend : `POST /api/v1/accounting/salary-requests/{id}/submit`. */
  submit(requestId: string): Promise<SalaryRequest>;
  /** Backend : `POST /api/v1/accounting/salary-requests/{id}/cancel`. Réservé aux demandes encore en brouillon. */
  cancel(requestId: string): Promise<SalaryRequest>;
}

/**
 * Documents personnels d'identité/qualification (CNI, diplôme, certification
 * pour le personnel — CNI, acte de naissance, CNI des parents pour un
 * élève). Permission appliquée côté serveur : propriétaire du document ou
 * direction de l'école — jamais un tiers (pas même un autre enseignant).
 * Backend : `document-service`, `/api/v1/personal-documents`.
 */
export interface PersonalDocumentsPort {
  list(ownerId: string, ownerType: PersonalDocumentOwnerType): Promise<PersonalDocument[]>;
  /** Backend : `POST /api/v1/personal-documents` (multipart). */
  upload(input: {
    ownerId: string;
    ownerType: PersonalDocumentOwnerType;
    type: PersonalDocumentType;
    titre: string;
    description?: string;
    file: File;
  }): Promise<PersonalDocument>;
  /** Backend : `DELETE /api/v1/personal-documents/{id}` — retrait logique, pas de suppression physique. */
  remove(documentId: string): Promise<void>;
}

/**
 * Documents pédagogiques d'une matière (cours, exercices, corrigés, sujets
 * d'examen, ressources) — déjà pris en charge côté backend
 * (`document-service`, `/api/v1/documents`), simplement non exposés côté
 * frontend avant cette fiche matière.
 */
export interface CourseDocumentsPort {
  /** Backend : `GET /api/v1/documents/subject/{subjectId}`. */
  list(subjectId: string): Promise<CourseDocument[]>;
  /** Backend : `POST /api/v1/documents` (multipart). */
  upload(input: {
    subjectId: string;
    type: CourseDocumentType;
    titre: string;
    description?: string;
    file: File;
  }): Promise<CourseDocument>;
  /** Backend : `DELETE /api/v1/documents/{id}`. */
  remove(documentId: string): Promise<void>;
}

export interface SignaturesPort {
  listDocuments(): Promise<SignedDocument[]>;
  listBulletinPeriods(): Promise<BulletinPeriod[]>;
  signForStudent(studentId: string, type: string, period: BulletinPeriod['key'] | null): Promise<SignedDocument>;
  signForStaff(staffId: string, type: string): Promise<SignedDocument>;
  signBulk(classId: string, period: BulletinPeriod['key']): Promise<{ signed: number }>;
  importToSign(targetKind: 'eleve' | 'personnel', targetId: string, fileName: string): Promise<SignedDocument>;
}

/**
 * Pilotage des résultats et bulletins — réservé aux actes de DIRECTION
 * (verrouiller, calculer, publier, générer, consulter). La saisie/modification
 * d'une note (`POST /academic/grades`, `PUT /academic/grades/{id}`) est un
 * acte ENSEIGNANT (`TEACHER`/`INSTITUTEUR`) côté backend et n'a volontairement
 * pas d'écran ici — ce n'est pas le rôle de cette application.
 *
 * Deux systèmes de génération de bulletin existent côté backend
 * (`academic-service` et `report-service`, génériques l'un comme l'autre
 * pour la classe entière) ; ce port s'appuie uniquement sur `academic-service`
 * car il est le seul branché sur le pipeline moyennes → résultats →
 * publication, avec le contrôle « non visible élève/parent avant
 * publication ». `report-service` reste la seule voie pour les stats école et
 * le rapport paiements (hors scope de ce port, voir Phase 1).
 */
export interface AcademicResultsPort {
  /** Backend : `GET /academic/config/effective`. `null` si aucune config n'a encore été posée pour cette portée. */
  getEffectiveConfig(classId?: string): Promise<AcademicYearConfig | null>;
  /** Backend : `POST /academic/config` — portée classe si `classId` fourni, sinon école entière. */
  configure(input: {
    classId: string | null;
    periodType: AcademicPeriodType;
    semesterCount: number;
    periods: Omit<AcademicPeriod, 'verrouillee'>[];
    d1Weight: number;
    d2Weight: number;
    compositionWeight: number;
    minPassAverage: number;
  }): Promise<AcademicYearConfig>;

  /** Backend : `PUT /academic/grades/lock`. Verrouille les notes d'une matière pour une classe/semestre — préalable au calcul des moyennes. */
  lockGrades(classId: string, subjectId: string, semesterNumber: number): Promise<void>;
  /** Backend : `POST /academic/averages/class/{classId}/semester/{semester}`. */
  computeClassAverages(classId: string, semesterNumber: number): Promise<void>;
  /** Backend : `POST /academic/results/class/{classId}/semester/{semester}`. Calcule rangs/mentions à partir des moyennes déjà calculées. */
  computeClassResults(classId: string, semesterNumber: number): Promise<void>;
  /** Backend : `GET /academic/results/class/{classId}/semester/{semester}`. Lit ce que `computeClassResults` a persisté — ne recalcule rien. */
  getClassSemesterResults(classId: string, semesterNumber: number): Promise<SemesterResult[]>;
  /** Backend : `PUT /academic/results/class/{classId}/semester/{semester}/publish`. Notifie élèves/parents (Kafka côté réel). */
  publishResults(classId: string, semesterNumber: number): Promise<SemesterResult[]>;
  /** Backend : `POST /academic/bulletins/student/{studentId}/semester/{semester}`. */
  generateStudentBulletin(studentId: string, semesterNumber: number): Promise<void>;
  /** Backend : `POST /academic/bulletins/class/{classId}/semester/{semester}` — asynchrone côté réel. */
  generateClassBulletins(classId: string, semesterNumber: number): Promise<void>;
  /** Backend : `GET /academic/bulletins/student/{studentId}/semester/{semester}/pdf`. */
  downloadBulletinPdf(studentId: string, semesterNumber: number): Promise<void>;

  /** Backend : `GET /academic/results/class/{classId}/annual`. */
  getClassYearResults(classId: string): Promise<YearResult[]>;
  /** Backend : `POST /academic/year/close`. Clôture les résultats de l'année — distincte de `SchoolPort.closeAcademicYear` (year-opening-service) et de la clôture école (`PUT /schools/{id}/year/close`) ; les trois orchestrations ne sont pas encore reliées dans ce prototype. */
  closeResultsYear(): Promise<void>;
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
  staffAbsences: StaffAbsencesPort;
  salaryRequests: SalaryRequestsPort;
  signatures: SignaturesPort;
  notices: NoticesPort;
  academicResults: AcademicResultsPort;
  personalDocuments: PersonalDocumentsPort;
  courseDocuments: CourseDocumentsPort;
}
