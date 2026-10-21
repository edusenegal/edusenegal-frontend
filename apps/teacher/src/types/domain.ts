/**
 * Modèle métier — ce que les écrans consomment.
 *
 * Même convention que `apps/director` et `apps/comptable` : les DTO réels
 * (`types/api.ts`) ne remontent jamais jusqu'aux écrans, traduits ici par la
 * couche service (`src/api/*.api.ts`).
 */

export type SchoolType = 'public' | 'prive';

export interface School {
  id: string;
  name: string;
  type: SchoolType;
  region: string;
  adresse: string;
  telephone: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  devise: string; // ex. "XOF"
}

export interface AcademicYear {
  id: string;
  label: string; // "2026-2027"
  statut: 'ouverte' | 'cloturee' | 'planifiee';
}

export interface TeacherProfile {
  id: string;
  prenom: string;
  nom: string;
  role: 'TEACHER' | 'INSTITUTEUR';
  email: string;
  tel: string | null;
  /** Matières de ce professeur dans cette école — ids `Subject`, à résoudre via `SubjectsPort`. */
  subjectIds: string[];
  photoUrl: string | null;
}

/** Coefficient de la matière pour une classe donnée — vient de la configuration de la matière. */
export interface SubjectCoefficient {
  classeId: string;
  valeur: number; // coefficient — 0 si facultative
  enseignee: boolean; // false = non enseignée dans cette classe
}

export interface Subject {
  id: string;
  code: string;
  nom: string;
  coefficients: SubjectCoefficient[]; // une entrée par classe de l'établissement
}

/** Une des classes où ce professeur enseigne — résolu côté frontend depuis `ClassInfoDto.teacherIds`. */
export interface MyClass {
  id: string;
  nom: string; // "Terminale S2"
  level: string;
  series: string | null;
  effectif: number;
  /** `true` si ce professeur est le professeur principal de cette classe. */
  estPrincipal: boolean;
}

export interface StudentRosterEntry {
  id: string;
  prenom: string;
  nom: string;
}

export type ScheduleSlotKind = 'cours' | 'permanence' | 'remplacement';

/** Traduit `TimetableSlotResponse` (schedule-service). */
export interface TimetableSlot {
  id: string;
  /** Brut -- pour pouvoir pré-sélectionner la classe (ex. "Appel" depuis le créneau en cours) sans la re-résoudre par son nom. */
  classId: string;
  classe: string; // nom de classe résolu côté frontend
  /** Brut, pour le dépôt de fichiers rattachés — `matiere` n'est que le libellé résolu. */
  subjectId: string | null;
  matiere: string | null;
  jour: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi' | 'Dimanche';
  heureDebut: string; // "08:00"
  heureFin: string;
  salle: string | null;
  kind: ScheduleSlotKind;
  remplacePar: string | null; // nom du remplaçant, si ce créneau est couvert par quelqu'un d'autre
  /** Note de préparation libre, ajoutée par l'enseignant — voir `SlotDetailSheet`. */
  description: string | null;
}

/** Traduit `AssessmentType` (common-lib). */
export type AssessmentType =
  | 'devoir1'
  | 'devoir2'
  | 'composition'
  | 'interro'
  | 'tp'
  | 'td'
  | 'devoir'
  | 'controle_continu'
  | 'examen'
  | 'projet'
  | 'expose'
  | 'stage';

/** Traduit `GradeResponse` (academic-service). */
export interface Grade {
  id: string;
  studentId: string;
  studentNom: string | null; // résolu côté frontend depuis le roster de la classe
  subjectId: string;
  subjectNom: string | null;
  semestre: number;
  type: AssessmentType;
  session: 1 | 2; // 1 = normale, 2 = rattrapage
  valeur: number;
  coefficient: number;
  commentaire: string | null;
  verrouillee: boolean;
}

export type GradeHistoryAction = 'entree' | 'mise_a_jour';

/** Une entrée de l'historique des modifications d'une note — traçabilité (`GradesPort.history`). */
export interface GradeHistoryEntry {
  id: string;
  gradeId: string;
  action: GradeHistoryAction;
  ancienneValeur: number | null;
  nouvelleValeur: number;
  ancienCommentaire: string | null;
  nouveauCommentaire: string | null;
  acteurId: string;
  acteurNom: string | null;
  le: string; // ISO-8601
}

/** Saisie d'une note — un élève à la fois, ou en lot (voir `GradesPort.enterBulk`). */
export interface GradeEntryInput {
  classId: string;
  studentId: string;
  subjectId: string;
  semestre: number;
  type: AssessmentType;
  session: 1 | 2;
  valeur: number;
  coefficient: number;
  commentaire?: string;
}

/** Traduit `Mention` (academic-service). */
export type Mention = 'excellent' | 'tres_bien' | 'bien' | 'assez_bien' | 'passable' | 'insuffisant';

export interface SubjectAverage {
  subjectId: string;
  subjectNom: string;
  moyenne: number;
  coefficient: number;
  mention: Mention;
}

/** Résultat semestriel d'un élève — traduit `SemesterResultResponse` (academic-service). */
export interface SemesterResult {
  id: string;
  studentId: string;
  studentNom: string;
  classId: string;
  semestre: number;
  moyenneGenerale: number;
  rangClasse: number;
  totalEleves: number;
  mention: Mention;
  matieres: SubjectAverage[];
  bulletinGenere: boolean;
  publie: boolean;
}

/** Traduit `GradeDisputeStatus` (academic-service). */
export type GradeDisputeStatus =
  | 'en_attente_professeur'
  | 'en_attente_surveillant'
  | 'en_attente_directeur'
  | 'en_attente_professeur_dirigee'
  | 'resolue_approuvee'
  | 'resolue_rejetee';

/** Traduit `GradeDisputeResponse` (academic-service) — réclamation d'un élève sur une note. */
export interface GradeDispute {
  id: string;
  studentId: string;
  classId: string;
  subjectId: string;
  subjectNom: string | null;
  /** Type d'évaluation de la note contestée — peut être absent si la note a depuis disparu. */
  type: AssessmentType | null;
  valeurContestee: number;
  valeurActuelle: number | null;
  motif: string;
  statut: GradeDisputeStatus;
  creeLe: string; // dd/mm/yyyy
}

/** Décision du professeur sur une réclamation — `TeacherDisputeDecisionRequest` (academic-service). */
export interface GradeDisputeDecisionInput {
  approuve: boolean;
  nouvelleValeur?: number;
  commentaire?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'retard' | 'justifie';

export interface AttendanceStudentEntry {
  studentId: string;
  statut: AttendanceStatus;
  note?: string;
}

/** Saisie de l'appel pour un créneau — `MarkAttendanceRequest` (attendance-service). */
export interface MarkAttendanceInput {
  classId: string;
  subjectId: string;
  date: string; // yyyy-mm-dd
  period: string; // "08:00-10:00"
  eleves: AttendanceStudentEntry[];
}

/**
 * Une session d'appel déjà enregistrée — item #401. Les noms de classe/
 * matière/élève ne sont PAS résolus ici : le composant les enrichit depuis
 * `myClasses`/`subjects`/`roster`, déjà chargés par ailleurs, plutôt que de
 * dupliquer cette résolution dans la couche API.
 */
export interface AttendanceSession {
  id: string;
  classId: string;
  subjectId: string;
  date: string; // yyyy-mm-dd
  period: string;
  students: AttendanceStudentEntry[];
}

/** Traduit `DocumentType` (document-service) — document pédagogique rattaché à une matière. */
export type CourseDocumentType = 'cours' | 'exercice' | 'corrige' | 'sujet_examen' | 'ressource' | 'autre';

export interface CourseDocument {
  id: string;
  subjectId: string;
  /** Rattaché à un créneau précis de l'emploi du temps, le cas échéant. */
  timetableSlotId: string | null;
  type: CourseDocumentType;
  titre: string;
  description: string | null;
  fileName: string;
  fileSizeBytes: number;
  downloadUrl: string;
  deposePar: string;
  dateDepot: string; // dd/mm/yyyy
}

export type PersonalDocumentOwnerType = 'personnel' | 'eleve';
export type PersonalDocumentType = 'cni' | 'diplome' | 'certification' | 'acte_naissance' | 'cni_parent' | 'autre';

export interface PersonalDocument {
  id: string;
  ownerId: string;
  ownerType: PersonalDocumentOwnerType;
  type: PersonalDocumentType;
  titre: string;
  description: string | null;
  fileName: string;
  fileSizeBytes: number;
  downloadUrl: string;
  deposePar: string;
  dateDepot: string; // dd/mm/yyyy
}

/** Traduit `ExamType` (schedule-service). */
export type ExamType = 'devoir1' | 'devoir2' | 'composition' | 'interro' | 'examen_blanc' | 'conseil_de_classe';

/** Traduit `ExamCalendarResponse` (schedule-service). */
export interface ExamEvent {
  id: string;
  classe: string;
  matiere: string | null;
  titre: string;
  type: ExamType;
  semestre: number;
  date: string; // dd/mm/yyyy
  heureDebut: string;
  heureFin: string;
  salle: string | null;
  visibleEleves: boolean;
}

export interface ScheduleExamInput {
  classId: string;
  subjectId: string;
  titre: string;
  type: ExamType;
  semestre: number;
  date: string; // yyyy-mm-dd
  heureDebut: string;
  heureFin: string;
  salle?: string;
}

/** Salle de classe du catalogue de l'école — sélectionnable pour un examen (voir `RoomsPort`). */
export interface ClassRoom {
  id: string;
  nom: string;
  capacite: number; // 0 = non renseignée
  classeId?: string;
}

/** Disponibilité d'une salle pour un créneau ponctuel (un examen) — voir `RoomsPort.checkAvailability`. */
export interface RoomAvailability {
  salleId: string;
  salleNom: string;
  capacite: number;
  disponible: boolean;
  raisonConflit: string | null; // null si disponible
}

/** Traduit `LeaveStatus` (schedule-service). */
export type LeaveStatus = 'en_attente' | 'approuve' | 'rejete';

/** Traduit `LeaveRequestResponse` (schedule-service) — demande de congé du professeur connecté. */
export interface LeaveRequest {
  id: string;
  dateDebut: string; // dd/mm/yyyy
  dateFin: string;
  motif: string;
  statut: LeaveStatus;
  remplacant: string | null;
  motifRefus: string | null;
}

export interface RequestLeaveInput {
  dateDebut: string; // yyyy-mm-dd
  dateFin: string;
  motif: string;
  remplacantId?: string;
  pieceJointe?: File;
}

/** Traduit `SalaryMode` (common-lib). */
export type SalaryMode = 'fixe' | 'par_jour' | 'par_heure';

/** Traduit `PaymentChannel` (payment-service). */
export type PaymentChannel = 'wave' | 'orange_money' | 'especes' | 'cheque' | 'virement_bancaire';

/** Bulletin de salaire — traduit `PayslipResponse` (payment-service), lecture seule. */
export interface SalarySlip {
  id: string;
  periode: string; // periodLabel, ex. "Octobre 2026"
  salaryMode: SalaryMode;
  montantBrut: number;
  joursTravailles: number | null;
  heuresTravaillees: number | null;
  joursAbsenceInjustifiee: number | null;
  payeurEtat: boolean; // true si payerOwnership === PUBLIC
  modePaiement: PaymentChannel | null;
  dateGeneration: string; // dd/mm/yyyy
}

/**
 * Avis de paiement en espèces en attente de ma confirmation — tant que je
 * n'ai pas confirmé (ou contesté), AUCUN bulletin n'existe encore pour cette
 * ligne : voir `PayslipsPort.confirmCashReceipt`/`rejectCashReceipt`.
 */
export interface CashPaymentNotice {
  requestId: string;
  periode: string; // periodLabel
  montantFcfa: number;
  valideLe: string | null; // dd/mm/yyyy, date de validation par le comptable
}

/** Traduit `GenerationStatus` (ai-service). */
export type QuizGenerationStatus = 'en_cours' | 'prete' | 'echouee';

export interface QuizQuestion {
  index: number;
  question: string;
  options: string[];
  bonneReponseIndex: number;
  explication: string | null;
}

/** Vue professeur d'un quiz généré par IA — traduit `QuizResponse` (ai-service). */
export interface Quiz {
  id: string;
  titre: string;
  classe: string | null;
  matiere: string | null;
  nombreQuestions: number;
  questions: QuizQuestion[];
  publie: boolean;
  statut: QuizGenerationStatus;
  motifEchec: string | null;
  nombreTentatives: number;
  creeLe: string; // dd/mm/yyyy
}

export interface GenerateQuizInput {
  classId?: string;
  subjectId?: string;
  matiere: string;
  sujet: string; // topic
  texteCours?: string;
  nombreQuestions: number;
}

/** Traduit `GroupType` (messaging-service). */
export type GroupKind = 'classe' | 'personnel' | 'parents' | 'personnalise';

export interface DiscussionGroup {
  id: string;
  nom: string;
  type: GroupKind;
  nombreMembres: number;
  nonLus: number;
  dernierMessageLe: string | null; // dd/mm/yyyy hh:mm
  jeSuisAdmin: boolean;
  archive: boolean;
}

export type MessageKind = 'texte' | 'fichier' | 'annonce';

export interface GroupMessage {
  id: string;
  auteurId: string;
  auteurNom: string;
  contenu: string;
  type: MessageKind;
  fichierUrl: string | null;
  fichierNom: string | null;
  envoyeLe: string; // dd/mm/yyyy hh:mm
  luParMoi: boolean;
}

/** Traduit `NotificationType`/`NotificationChannel` (notification-service) — simplifié pour l'affichage. */
export interface AppNotification {
  id: string;
  titre: string;
  corps: string;
  lue: boolean;
  recueLe: string; // dd/mm/yyyy hh:mm
}

/** Traduit `ComplaintType`/`ComplaintStatus` (complaint-service). */
export type ComplaintType =
  | 'contre_professeur'
  | 'contestation_note'
  | 'emploi_du_temps'
  | 'infrastructure'
  | 'administratif'
  | 'suggestion'
  | 'autre';

export type ComplaintStatus = 'soumise' | 'en_cours' | 'resolue' | 'rejetee' | 'archivee';

export interface Complaint {
  id: string;
  type: ComplaintType;
  sujet: string;
  description: string;
  statut: ComplaintStatus;
  resolution: string | null;
  creeLe: string; // dd/mm/yyyy
}

export interface CreateComplaintInput {
  type: ComplaintType;
  sujet: string;
  description: string;
  anonyme?: boolean;
  pieceJointe?: File;
}

export interface TeacherDashboard {
  classesCount: number;
  elevesCount: number;
  examensAVenir: number;
  reclamationsEnAttente: number;
  notificationsNonLues: number;
}
