/**
 * Modèle métier — ce que les écrans consomment.
 *
 * Traduit depuis les DTO (`types/api.ts`) par la couche service : identifiants
 * bruts résolus en objets, enums traduits en libellés français, dates ISO
 * prêtes à formater. Aucun écran ne lit `types/api.ts`.
 */

export type SchoolType = 'public' | 'prive';

export interface School {
  id: string;
  name: string;
  type: SchoolType;
  niveau: 'lycee';
  region: string;
  adresse: string;
  telephone: string;
  email: string;
  logoUrl: string | null;
  brandColor: string;
  devise: string; // ex. "XOF"
}

export interface AcademicYear {
  id: string;
  label: string; // "2026-2027"
  statut: 'ouverte' | 'cloturee' | 'planifiee';
  dateDebut: string; // dd/mm/yyyy
  dateFin: string;
}

export type ClassLevel = 'Seconde' | 'Première' | 'Terminale';

export interface ClassGroup {
  id: string;
  level: ClassLevel;
  series: string | null; // "L", "S1", "S2" — null en Seconde
  tag: string | null; // "A" quand il y a plusieurs divisions
  name: string; // nom affiché, ex. "Terminale S2"
  effectif: number;
  capacite: number;
  homeroomTeacherId: string | null;
  itinerantTeacherIds: string[];
}

export type EventType = 'Devoir' | 'Examen' | 'Composition' | 'Conseil de classe';

export interface ClassEvent {
  id: string;
  classeId: string;
  type: EventType;
  titre: string;
  /** Id de la matière (liste déroulante des matières ENSEIGNÉES DANS CETTE CLASSE) — `null` pour un conseil de classe. */
  subjectId: string | null;
  /** Nom de matière résolu côté backend (`ExamCalendarResponse.subjectName`), pour affichage seulement. */
  matiere: string | null;
  /** Id du professeur en charge de cette échéance. */
  teacherId: string | null;
  /** Nom du professeur résolu côté backend (`ExamCalendarResponse.teacherName`), pour affichage seulement. */
  professeur: string | null;
  semestre: 1 | 2;
  date: string; // dd/mm/yyyy
  heureDebut: string; // "08:00"
  heureFin: string;
  salle: string | null;
  notes: string;
}

export type ScheduleSlotKind = 'cours' | 'permanence' | 'libre';

export interface ScheduleSlot {
  jour: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi';
  heureDebut: string; // "08:00"
  heureFin: string;
  /** Id de la matière (liste déroulante des matières ENSEIGNÉES DANS CETTE CLASSE). */
  subjectId: string | null;
  /** Nom de matière résolu côté backend, pour affichage seulement. */
  matiere: string | null;
  enseignantId: string | null;
  /** Nom du professeur résolu côté backend, pour affichage seulement. */
  professeur: string | null;
  salle: string | null;
  kind: ScheduleSlotKind;
}

export type StaffStatus = 'actif' | 'en_conge';

/**
 * Traduit `SalaryMode` (common-lib, partagé user-service/payment-service) :
 * FIXED, PER_WORKED_DAY, PER_HOUR.
 */
export type SalaryMode = 'fixe' | 'par_jour' | 'par_heure';

export interface Teacher {
  id: string;
  nom: string;
  /**
   * Matières enseignées par ce professeur dans cet établissement — ids
   * `Subject` (backend : `UserResponse.subjectIds`), à résoudre en noms côté
   * UI via `SubjectsPort.list()` (même pattern que `itinerantTeacherIds` sur
   * `ClassGroup`). Tableau vide tant qu'aucune matière n'a été assignée.
   */
  subjectIds: string[];
  tel: string;
  email: string;
  statut: StaffStatus;
  classes: string[]; // noms de classes, ex. "Terminale S2"
  /**
   * Rémunération de cet enseignant DANS CET ÉTABLISSEMENT — un enseignant
   * itinérant qui enseignerait ailleurs aurait un profil distinct par école
   * côté backend (`SchoolSalaryProfileResponse`, un par couple
   * userId/schoolId) ; cette application ne gère que l'établissement du
   * directeur connecté, donc un seul profil par enseignant ici. Un seul des
   * trois montants est pertinent selon `salaryMode`.
   */
  /**
   * `null` tant qu'aucun salaire n'a été configuré pour cet enseignant dans
   * cette école (mirroring : `SchoolSalaryProfileResponse.salaryMode` est
   * `null` avant le premier `PUT .../salary` côté backend — une tentative de
   * créer une demande de paiement pour un enseignant dans cet état échoue
   * avec `SALARY_NOT_CONFIGURED`).
   */
  salaryMode: SalaryMode | null;
  salaireFixe: number | null; // fixedAmountFcfa — pertinent si salaryMode === 'fixe'
  tauxJournalier: number | null; // dailyRateFcfa — pertinent si salaryMode === 'par_jour'
  tauxHoraire: number | null; // hourlyRateFcfa — pertinent si salaryMode === 'par_heure'
}

/** Absence de personnel enseignant, saisie par la direction — traduit `StaffAbsenceResponse` (attendance-service). */
export interface StaffAbsence {
  id: string;
  teacherId: string;
  dateDebut: string; // dd/mm/yyyy
  dateFin: string;
  justifiee: boolean;
  motif: string | null;
  enregistreePar: string;
}

/** Agrégat sur une période — traduit `StaffAbsenceSummaryResponse` ; utilisé pour calculer une demande de paiement en mode "par jour". */
export interface StaffAbsenceSummary {
  joursJustifies: number;
  joursInjustifies: number;
}

/**
 * Bulletin de paie — traduit `PayslipResponse` (payment-service). Généré
 * automatiquement à la validation d'une `SalaryRequest`, une fois par ligne
 * (un enseignant, une période) ; jamais créé directement depuis cette
 * application.
 */
export interface SalarySlip {
  id: string;
  teacherId: string;
  /** staffFullName — pour construire un nom de fichier lisible au téléchargement. */
  teacherNom: string;
  periode: string; // periodLabel, ex. "Octobre 2026"
  salaryMode: SalaryMode;
  montantBrut: number; // grossAmountFcfa
  joursTravailles: number | null;
  heuresTravaillees: number | null;
  joursAbsenceInjustifiee: number | null;
  /** `true` si payerOwnership === PUBLIC (État) — sinon pris en charge par l'école (payerOwnership === PRIVATE). */
  payeurEtat: boolean;
  dateGeneration: string; // dd/mm/yyyy
}

export type StudentStatus = 'actif' | 'suspendu' | 'transfere';

export interface Student {
  id: string;
  prenom: string;
  nom: string;
  classeId: string;
  classe: string;
  dateNaissance: string; // dd/mm/yyyy
  sexe: 'M' | 'F';
  parent: string;
  tel: string;
  statut: StudentStatus;
  moyenne: number;
  absences: number;
  retards: number;
  tauxPaiement: number; // %
  photoUrl: string | null;
}

export interface SubjectCoefficient {
  classeId: string;
  valeur: number; // coefficient — 0 si facultative
  enseignee: boolean; // false = non enseignée dans cette classe
}

export interface Subject {
  id: string;
  code: string; // "MATH", "PC"…
  nom: string;
  optionnelle: boolean;
  global: boolean; // matière du catalogue global — non supprimable depuis cet écran
  coefficients: SubjectCoefficient[]; // une entrée par classe de l'établissement
}

/**
 * Mode de facturation de la scolarité. Traduit `PaymentType`
 * (payment-service) : INSCRIPTION_ONLY, MONTHLY, QUARTERLY, ANNUAL,
 * INSCRIPTION_MONTHLY, INSCRIPTION_QUARTERLY, INSCRIPTION_ANNUAL,
 * SCHOLARSHIP.
 */
export type PaymentType =
  | 'inscription_seule'
  | 'mensuel'
  | 'trimestriel'
  | 'annuel'
  | 'inscription_mensuel'
  | 'inscription_trimestriel'
  | 'inscription_annuel'
  | 'bourse';

/** Traduit `PaymentChannel` (payment-service) : WAVE, ORANGE_MONEY, CASH, CHEQUE, VIREMENT_BANCAIRE. */
export type PaymentChannel = 'wave' | 'orange_money' | 'especes' | 'cheque' | 'virement_bancaire';

export interface LevelPricing {
  level: string; // "Seconde", "Première", "Terminale"…
  series: string | null;
  displayName: string;
  inscriptionFcfa: number;
  periodFcfa: number; // par mois/trimestre/année selon `type`
  totalAnnualFcfa: number; // inscription + (période × nombre de périodes)
}

export interface PaymentConfig {
  id: string;
  type: PaymentType;
  levelPricings: LevelPricing[];
  installmentAllowed: boolean;
  maxInstallments: number;
  deferredAllowed: boolean;
  maxDeferDays: number;
  alertDaysBefore: number;
  enabledChannels: PaymentChannel[];
  updatedAt: string; // dd/mm/yyyy
}

export type LeaveStatus = 'en_attente' | 'approuve' | 'rejete';

export interface LeaveRequest {
  id: string;
  teacherId: string;
  teacherNom: string;
  dateDebut: string;
  dateFin: string;
  motif: string;
  statut: LeaveStatus;
  remplacant: string | null;
  pieceJointe: { nom: string } | null;
}

/** Traduit `SalaryPaymentStatus` (payment-service) : DRAFT, PENDING_VALIDATION, VALIDATED, REJECTED, CANCELLED. */
export type SalaryRequestStatus = 'brouillon' | 'en_attente' | 'validee' | 'rejetee' | 'annulee';

/** Une ligne de la demande — traduit `SalaryLineResponse`, un enseignant payé sur la période. */
/** Traduit `PayoutStatus` (payment-service) — état d'EXÉCUTION du versement d'une ligne, distinct du statut de la demande. `null` tant que la demande n'a pas été validée par le comptable. */
export type PayoutStatus = 'en_attente' | 'paye' | 'echec' | 'attente_confirmation_cash';

export interface SalaryRequestLine {
  teacherId: string;
  teacherNom: string;
  salaryMode: SalaryMode;
  joursTravailles: number | null;
  heuresTravaillees: number | null;
  joursAbsenceInjustifiee: number | null;
  montantCalcule: number;
  payeurEtat: boolean;
  payslipId: string | null;
  /** Choisi par le directeur à la création de la demande — cash par défaut. */
  modePaiement: PaymentChannel;
  /** Numéro de téléphone pour wave/orange_money — le numéro du personnel par défaut, voir `SalaryRequestsPort.create`. */
  destinationPaiement: string | null;
  /**
   * Renseigné UNIQUEMENT une fois la demande validée par le comptable (hors
   * de cette application — voir `SalaryRequestsPort`) : exécution réelle du
   * versement de cette ligne. `null` tant que la demande est en brouillon ou
   * en attente de validation.
   */
  statutVersement: PayoutStatus | null;
  referenceTransaction: string | null;
  motifEchecPaiement: string | null;
}

/** Traduit `ValidationStep` (payment-service) — une décision du circuit de validation d'une demande de paiement de salaire. */
export interface SalaryValidationStep {
  validatorId: string;
  validatorRole: string;
  decision: ExpenseDecision;
  commentaire: string | null;
  decideLe: string; // dd/mm/yyyy hh:mm
}

/**
 * Demande de paiement de salaire — traduit `SalaryPaymentRequestResponse`
 * (payment-service). Couvre PLUSIEURS enseignants sur une même période ; le
 * montant de chaque ligne est calculé côté serveur (profil de salaire +
 * absences), jamais saisi ici.
 */
export interface SalaryRequest {
  id: string;
  periode: string; // periodLabel, ex. "Octobre 2026"
  dateDebut: string; // dd/mm/yyyy, periodStart
  dateFin: string; // dd/mm/yyyy, periodEnd
  lignes: SalaryRequestLine[];
  montantTotal: number;
  statut: SalaryRequestStatus;
  dateCreation: string;
  motifRejet: string | null;
  historiqueValidation: SalaryValidationStep[];
  /** Renseigné quand cette demande est née d'un règlement partiel d'une autre. */
  splitFromRequestId: string | null;
  /**
   * Renseigné UNIQUEMENT sur la réponse à la décision qui a produit un
   * reliquat : id de la nouvelle demande brouillon créée pour les lignes
   * non réglées (solde insuffisant au moment de l'approbation).
   */
  splitIntoRequestId: string | null;
}

export type DocumentTargetKind = 'eleve' | 'personnel';

export interface SignedDocument {
  serie: string;
  type: string; // "Bulletin — 1er trimestre", "Attestation de travail"…
  cible: string; // nom lisible de la personne concernée
  cibleKind: DocumentTargetKind;
  date: string;
  signataire: string;
}

export interface BulletinPeriod {
  key: 't1' | 't2' | 't3';
  label: string;
  available: boolean;
}

export type NoticeDestType = 'ecole' | 'classe' | 'personnel' | 'eleve';

export interface Notice {
  id: string;
  titre: string;
  corps: string;
  destType: NoticeDestType;
  destLabel: string;
  date: string;
  auteur: string;
}

export type TransferMode = 'interne' | 'externe';

export interface TransferRequest {
  id: string;
  studentId: string;
  studentNom: string;
  mode: TransferMode;
  classeDepartId: string | null;
  classeArriveeId: string | null;
  regionDestination: string | null;
  ecoleDestination: string | null;
  statut: 'en_attente' | 'acceptee' | 'refusee';
  date: string;
}

/** Traduit `PeriodType` (academic-service) : SEMESTER, TRIMESTER, ANNUAL. */
export type AcademicPeriodType = 'semestre' | 'trimestre' | 'annuel';

/** Traduit `SemesterPeriod` (academic-service) — une période (semestre/trimestre) de l'année académique. */
export interface AcademicPeriod {
  number: number; // 1, 2, 3 ou 4
  label: string; // "Semestre 1"…
  dateDebut: string; // dd/mm/yyyy
  dateFin: string;
  dateLimiteNotes: string; // date limite de saisie des notes
  dateBulletin: string; // date de remise des bulletins
  verrouillee: boolean;
}

/**
 * Configuration de l'année académique (nombre de semestres, pondérations,
 * moyenne de passage) — portée école, niveau ou classe (résolution par
 * priorité classe > niveau > école, comme côté backend).
 * Backend : `AcademicConfigController` (academic-service).
 */
export interface AcademicYearConfig {
  id: string;
  levelTarget: string | null;
  classId: string | null;
  periodType: AcademicPeriodType;
  semesterCount: number; // 1 à 4
  periods: AcademicPeriod[];
  d1Weight: number;
  d2Weight: number;
  compositionWeight: number;
  minPassAverage: number; // sur 20
  updatedAt: string; // dd/mm/yyyy
}

/** Traduit `Mention` (academic-service). */
export type Mention = 'excellent' | 'tres_bien' | 'bien' | 'assez_bien' | 'passable' | 'insuffisant';

/** Traduit `PromotionResult` (academic-service) : PROMOTED, EXCEPTIONAL, RETAINED, EXCLUDED. */
export type PromotionResult = 'admis' | 'admis_exceptionnel' | 'redouble' | 'exclu';

/** Moyenne d'une matière pour un élève sur un semestre — traduit `SubjectAverage`. */
export interface SubjectAverage {
  subjectId: string;
  subjectNom: string;
  d1: number | null;
  d2: number | null;
  composition: number | null;
  moyenne: number;
  coefficient: number;
  pointsPonderes: number;
  mention: Mention;
}

/**
 * Résultat semestriel d'un élève — traduit `SemesterResultResponse`.
 * `bulletinGenerated`/`published` reflètent l'état réel côté backend (le
 * bulletin PDF n'existe/n'est visible élève-parent qu'une fois ces deux
 * étapes franchies).
 */
export interface SemesterResult {
  id: string;
  studentId: string;
  studentNom: string;
  classId: string;
  semesterNumber: number;
  moyenneGenerale: number;
  rangClasse: number;
  totalEleves: number;
  mention: Mention;
  matieres: SubjectAverage[];
  bulletinGenere: boolean;
  publie: boolean;
}

/** Bilan annuel d'un élève — traduit `YearResultResponse`. */
export interface YearResult {
  id: string;
  studentId: string;
  studentNom: string;
  classId: string;
  moyenneAnnuelle: number;
  rangClasse: number;
  totalEleves: number;
  mention: Mention;
  decision: PromotionResult;
  matieres: SubjectAverage[];
  cloture: boolean;
}

export interface DashboardSnapshot {
  effectifTotal: number;
  effectifGarcons: number;
  effectifFilles: number;
  presenceDuJour: number; // %
  soldeCaisse: number;
  demandesEnAttente: number;
  classesCount: number;
  enseignantsCount: number;
}

export interface DirectorProfile {
  id: string;
  prenom: string;
  nom: string;
  role: 'DIRECTOR';
  email: string;
}

export interface AuthSession {
  director: DirectorProfile;
  school: School;
}

/**
 * Résultat d'une recherche d'utilisateur par téléphone, à la création d'un
 * enseignant — permet d'éviter un doublon si la personne existe déjà
 * (potentiellement rattachée à une autre école). Traduit `UserLookupResponse`
 * (user-service). `null` si aucun utilisateur ne porte ce numéro.
 */
export interface TeacherLookupResult {
  userId: string;
  nom: string;
  tel: string;
  email: string;
  /** `true` si cette personne est déjà enseignante dans CET établissement — rattachement impossible, redondant. */
  dejaDansCetEtablissement: boolean;
}

/** Qui porte le document personnel — distingue les types applicables (voir `PERSONAL_DOCUMENT_TYPES_BY_OWNER`). */
export type PersonalDocumentOwnerType = 'personnel' | 'eleve';

/** Traduit `PersonalDocumentType` (document-service). CNI commun aux deux profils. */
export type PersonalDocumentType = 'cni' | 'diplome' | 'certification' | 'acte_naissance' | 'cni_parent' | 'autre';

/**
 * Document personnel d'identité/qualification (CNI, diplôme, certification
 * pour le personnel — CNI, acte de naissance, CNI des parents pour un
 * élève). Traduit `PersonalDocumentResponse` (document-service) — distinct
 * des documents pédagogiques (`CourseDocument`) et des bulletins de paie
 * (`SalarySlip`).
 */
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

/** Traduit `DocumentType` (document-service) — document pédagogique rattaché à un cours. */
export type CourseDocumentType = 'cours' | 'exercice' | 'corrige' | 'sujet_examen' | 'ressource' | 'autre';

/**
 * Document pédagogique d'une matière (cours, exercice, corrigé, sujet
 * d'examen, ressource) — traduit `DocumentResponse` (document-service),
 * filtré par matière depuis cette fiche.
 */
export interface CourseDocument {
  id: string;
  subjectId: string;
  type: CourseDocumentType;
  titre: string;
  description: string | null;
  fileName: string;
  fileSizeBytes: number;
  downloadUrl: string;
  deposePar: string;
  dateDepot: string; // dd/mm/yyyy
}

// ════════════════════════════════════════════════════════════════════════
// Espace comptabilité — profil, dépenses.
// ════════════════════════════════════════════════════════════════════════

export interface AccountantProfile {
  id: string;
  prenom: string;
  nom: string;
  role: 'ACCOUNTANT';
  email: string;
}

/** Traduit `ExpenseCategory` (payment-service). */
export type ExpenseCategory =
  | 'salaires'
  | 'fournitures_bureau'
  | 'materiel_pedagogique'
  | 'electricite'
  | 'eau'
  | 'internet'
  | 'loyer'
  | 'maintenance'
  | 'transport'
  | 'communication'
  | 'frais_bancaires'
  | 'autres';

/** Traduit `ExpenseStatus` (payment-service). */
export type ExpenseStatus = 'brouillon' | 'en_attente' | 'validee' | 'rejetee' | 'annulee';

export type ExpenseDecision = 'approuve' | 'rejete';

/** Traduit `ValidationStep` (payment-service) — une décision du circuit de validation. */
export interface ExpenseValidationStep {
  validatorId: string;
  /** `ROLE_ACCOUNTANT`, `ROLE_DIRECTOR`, `ROLE_SUPER_ADMIN` — tel que posé côté backend. */
  validatorRole: string;
  decision: ExpenseDecision;
  commentaire: string | null;
  decideLe: string; // dd/mm/yyyy hh:mm
}

/**
 * Demande de paiement générale — traduit `ExpenseResponse`
 * (`ExpenseController`, payment-service). Couvre toute dépense de
 * l'établissement (fournitures, loyer, électricité, salaires…), à la
 * différence de `SalaryRequest` qui reste le circuit dédié exclusivement
 * à la paie enseignante. Création/soumission côté direction, décision
 * finale côté comptable (voir `ExpensesPort`).
 */
export interface Expense {
  id: string;
  schoolId: string;
  academicYearId: string;
  categorie: ExpenseCategory;
  libelle: string;
  montantFcfa: number;
  dateDepense: string; // dd/mm/yyyy
  fournisseur: string | null;
  statut: ExpenseStatus;
  creePar: string;
  valideParRole: string | null;
  valideLe: string | null; // dd/mm/yyyy hh:mm
  motifRejet: string | null;
  /** URLs pré-signées MinIO des justificatifs. */
  piecesJointes: string[];
  historiqueValidation: ExpenseValidationStep[];
  creeLe: string; // dd/mm/yyyy hh:mm
}

// ════════════════════════════════════════════════════════════════════════
// Espace comptabilité — caisse, grand livre.
// ════════════════════════════════════════════════════════════════════════

/** Traduit `CashSessionStatus` (payment-service) : OPEN, CLOSED. */
export type CashSessionStatus = 'ouverte' | 'cloturee';

/** Une ligne d'encaissement du jour ventilée par canal — calculée uniquement à la clôture. */
export interface CashSessionIncomeLine {
  canal: PaymentChannel;
  montantFcfa: number;
}

/**
 * Session de caisse journalière d'un comptable — traduit `CashSessionResponse`
 * (payment-service). Une par (comptable, jour) ; l'ouverture est idempotente
 * (`CashSessionService.openSession` retourne la session existante si déjà
 * ouverte aujourd'hui) et la clôture calcule l'écart entre le solde théorique
 * (encaissements du jour − dépenses validées du jour) et le comptage
 * physique annoncé par le comptable — une justification devient obligatoire
 * dès que cet écart n'est pas nul (voir `CashSessionsPort.close`).
 */
export interface CashSession {
  id: string;
  cashierId: string;
  dateSession: string; // dd/mm/yyyy
  statut: CashSessionStatus;
  /** Vide tant que la session est ouverte. */
  encaissementsParCanal: CashSessionIncomeLine[];
  totalEncaissements: number | null;
  totalDepenses: number | null;
  soldeTheorique: number | null;
  comptagePhysique: number | null;
  ecart: number | null;
  justificationEcart: string | null;
  ouvertureLe: string; // dd/mm/yyyy hh:mm
  clotureLe: string | null;
}

/**
 * Grand livre de l'école — solde courant, traduit `LedgerResponse`
 * (payment-service). Mis à jour automatiquement côté backend à chaque
 * encaissement élève complété ou dépense validée — lecture seule ici,
 * aucune action ne le modifie depuis cette application.
 */
export interface SchoolLedger {
  totalEncaissements: number;
  totalDepenses: number;
  solde: number;
  derniereMajLe: string | null; // dd/mm/yyyy hh:mm
}

/** Granularité d'agrégation de l'historique du ledger (dashboard, export Excel). */
export type LedgerGranularity = 'day' | 'week' | 'month' | 'year';

/** Un point d'évolution -- un bucket temporel avec ses entrées et sorties. */
export interface LedgerHistoryPoint {
  period: string;
  entreesFcfa: number;
  sortiesFcfa: number;
}

/** Historique daté des entrées/sorties -- alimente le dashboard et l'export Excel. */
export interface LedgerHistory {
  granularite: LedgerGranularity;
  points: LedgerHistoryPoint[];
  totalEntreesFcfa: number;
  totalSortiesFcfa: number;
  solde: number;
}

/**
 * Personnel pouvant être payé via une demande de salaire — restreint au
 * personnel enseignant (TEACHER/INSTITUTEUR) : c'est aujourd'hui le seul
 * personnel dont le salaire peut être configuré (`apps/director`, fiche
 * enseignant, `PUT .../salary`) — tout autre rôle ferait échouer le calcul
 * de la ligne côté backend (`SALARY_NOT_CONFIGURED`).
 */
export interface PayrollStaffMember {
  id: string;
  nom: string;
  tel: string | null;
  /** `null` tant qu'aucun salaire n'a jamais été configuré pour ce personnel dans cette école. */
  salaryMode: SalaryMode | null;
  salaireFixe: number | null;
  tauxJournalier: number | null;
  tauxHoraire: number | null;
}

/**
 * Élève trouvé par une recherche nom/prénom — traduit `UserResponse`
 * (user-service) + sa classe résolue côté frontend (voir `fetchSchoolClasses`,
 * même principe que `apps/director/src/api/students.api.ts`). Volontairement
 * minimal : seul écran consommateur aujourd'hui, le picker de
 * `WalletPage`, n'a besoin que d'identifier/afficher l'élève, pas de sa
 * fiche complète (`apps/director` reste la source pour ça).
 */
export interface StudentPickerEntry {
  id: string;
  nom: string;
  classe: string;
}

/**
 * Nature d'un mouvement du portefeuille élève — traduit `WalletTransactionType`
 * (payment-service). `achat_ticket` et `debit_manuel` n'apparaissent qu'en
 * lecture dans l'historique : seuls `bourse`/`credit_manuel`/`remboursement`
 * sont saisissables ici (voir `WalletPort.credit`) ; un débit saisi depuis
 * cet écran est toujours `debit_manuel` (voir `WalletPort.debit`).
 */
export type WalletTransactionType = 'bourse' | 'achat_ticket' | 'credit_manuel' | 'debit_manuel' | 'remboursement';

/** Sous-ensemble saisissable par le comptable via `WalletPort.credit`. */
export type WalletCreditType = 'bourse' | 'credit_manuel' | 'remboursement';

/** Mouvement du portefeuille élève — traduit `WalletTransactionResponse`. */
export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  credit: boolean;
  montantFcfa: number;
  soldeApresFcfa: number;
  note: string | null;
  date: string; // dd/mm/yyyy hh:mm
}

/**
 * Portefeuille campus d'un élève — crédit interne non convertible (jamais
 * une monnaie électronique), traduit `WalletResponse` (payment-service).
 * Alimenté par les versements de bourse réconciliés et débité par les
 * achats de tickets resto ; `credit`/`debit` ici ne couvrent que les
 * corrections manuelles exceptionnelles du back-office (voir `WalletPort`).
 */
export interface StudentWallet {
  studentId: string;
  soldeFcfa: number;
  totalCrediteFcfa: number;
  totalDebiteFcfa: number;
  derniereMajLe: string | null; // dd/mm/yyyy hh:mm
}

/** Traduit `TransactionStatus` (payment-service) : PENDING, COMPLETED, FAILED, REFUNDED, OVERDUE. */
export type PaymentTransactionStatus = 'en_attente' | 'complete' | 'echoue' | 'rembourse' | 'en_retard';

/**
 * Encaissement/paiement élève — traduit `PaymentTransactionResponse`
 * (payment-service). `montantNetFcfa` tient déjà compte d'une remise bourse
 * éventuelle (`remiseFcfa`), appliquée automatiquement côté serveur si une
 * bourse ACTIVE couvre l'élève — jamais saisie ici.
 */
export interface PaymentTransaction {
  id: string;
  type: PaymentType;
  statut: PaymentTransactionStatus;
  montantFcfa: number;
  remiseFcfa: number;
  montantNetFcfa: number;
  canal: PaymentChannel;
  period: string | null;
  echeanceNumero: number;
  echeancesTotal: number;
  dateEcheance: string | null; // dd/mm/yyyy
  datePaiement: string | null; // dd/mm/yyyy
  receiptUrl: string | null;
  scholarshipId: string | null;
  dateCreation: string; // dd/mm/yyyy hh:mm
}

/**
 * Encaissement du jour affiché dans l'écran Caisse — `PaymentTransaction`
 * enrichi de l'identifiant de l'élève concerné (la caisse n'est pas scopée à
 * un seul élève, contrairement à l'écran Paiements).
 */
export interface CashIncomeEntry extends PaymentTransaction {
  studentId: string;
}

/** Traduit `RestoTicketStatus` (payment-service) : ISSUED, REDEEMED, EXPIRED, CANCELLED. */
export type RestoTicketStatus = 'emis' | 'utilise' | 'expire' | 'annule';

/**
 * Achat de ticket de restaurant universitaire — traduit
 * `RestoTicketPurchaseResponse`. Lecture seule ici : l'achat lui-même est
 * réservé à l'élève, le pointage au personnel de cantine (voir
 * `RestoTicketController`).
 */
export interface RestoTicketPurchase {
  id: string;
  ticketTypeLabel: string;
  prixFcfa: number;
  codeAchat: string;
  statut: RestoTicketStatus;
  acheteLe: string; // dd/mm/yyyy hh:mm
  expireLe: string | null;
  utiliseLe: string | null;
}

/** Traduit `ScholarshipStatus` (payment-service). */
export type ScholarshipStatus = 'en_attente_validation' | 'validee' | 'rejetee' | 'active' | 'suspendue' | 'terminee';

/** Statut d'une tranche de bourse — traduit `ScholarshipPaymentStatus` : EXPECTED, PAID, LATE, PARTIAL, PENDING. */
export type ScholarshipSliceStatus = 'attendue' | 'payee' | 'en_retard' | 'partielle' | 'en_cours';

/** Tranche planifiée d'un dossier de bourse — traduit `ScholarshipPaymentSlice`. */
export interface ScholarshipSlice {
  id: string;
  montantAttenduFcfa: number;
  dateEcheance: string; // dd/mm/yyyy
  montantPayeFcfa: number;
  dernierVersementLe: string | null; // dd/mm/yyyy
  statut: ScholarshipSliceStatus;
  justificatifUrl: string | null;
  note: string | null;
}

/**
 * Dossier de bourse d'un élève — traduit `ScholarshipResponse`
 * (payment-service). Création/validation/activation restent hors périmètre
 * comptable (voir `ScholarshipsPort`) : cet écran ne fait qu'enregistrer les
 * versements de tranches reçus de la structure payeuse et consulter l'état
 * du dossier.
 */
export interface Scholarship {
  id: string;
  studentId: string;
  payeurNom: string;
  payeurType: string;
  payeurContact: string | null;
  payeurReference: string | null;
  pourcentageCouvert: number;
  montantAnnuelTotalFcfa: number;
  montantCouvertFcfa: number;
  resteEleveFcfa: number;
  statut: ScholarshipStatus;
  motifRejet: string | null;
  tranches: ScholarshipSlice[];
  totalPayeParPayeurFcfa: number;
  resteAPayerParPayeurFcfa: number;
  progressionPayeurPercent: number;
  dateCreation: string; // dd/mm/yyyy
}
