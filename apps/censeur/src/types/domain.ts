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
  /** Fond de la barre latérale (nav) — task #231. */
  primaryColor: string;
  /** Fond des boutons et de la section choisie dans le menu — task #231 (c'était l'unique `brandColor` auparavant). */
  secondaryColor: string;
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
  /** Salle de classe par défaut (task #229) — id `ClassRoom`, `null` tant qu'aucune n'est rattachée. */
  defaultRoomId: string | null;
}

export type EventType = 'Devoir' | 'Examen' | 'Composition' | 'Conseil de classe';

export interface ClassEvent {
  id: string;
  classeId: string;
  /** Nom de la classe résolu côté backend (`ExamCalendarResponse.className`) — vue enseignant multi-classes. */
  classe?: string | null;
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

/** Créneau de l'emploi du temps d'UN professeur (toutes classes confondues). */
export interface TeacherScheduleSlot {
  jour: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi';
  heureDebut: string; // "08:00"
  heureFin: string;
  matiere: string | null;
  classe: string;
  salle: string | null;
  remplacant: string | null;
}

/**
 * État de verrouillage de la version ACTIVE de l'emploi du temps d'une
 * classe (task #425, demande censeur/surveillant général) — reflète
 * `TimetableVersionResponse.locked/lockedBy/lockedAt` (schedule-service).
 * Tant qu'elle est verrouillée, `createTimetable`/`changeTimetable` sur
 * cette classe sont refusés côté backend (409) : ajouter, retirer ou
 * modifier un créneau nécessite de déverrouiller d'abord.
 */
export interface TimetableLock {
  versionId: string;
  locked: boolean;
  lockedBy: string | null;
  lockedAt: string | null;
}

/**
 * Traduit `AccountStatus` (user-service) : ACTIVE, SUSPENDED, TRANSFERRED,
 * PENDING_ACTIVATION — il n'existe PAS de statut de compte « en congé » côté
 * backend (voir `StaffAbsencesPort`, qui trace des congés PONCTUELS, pas un
 * statut de compte).
 */
export type StaffStatus = 'actif' | 'suspendu' | 'transfere' | 'en_attente';

/**
 * Traduit `SalaryMode` (common-lib, partagé user-service/payment-service) :
 * FIXED, PER_WORKED_DAY, PER_HOUR.
 */
export type SalaryMode = 'fixe' | 'par_jour' | 'par_heure';

export interface Teacher {
  id: string;
  nom: string;
  photoUrl: string | null;
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

// ── Présence & absences élèves (items #400/#402) ────────────────────────────

/** Taux présence/absence/retard de l'école, sur une période — tableau de bord directeur. */
export interface SchoolAttendanceOverview {
  from: string; // ISO
  to: string; // ISO
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
}

/** Même ventilation, PAR CLASSE — drill-down depuis `SchoolAttendanceOverview` (#400). */
export interface ClassAttendanceRate {
  classId: string;
  className: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
}

/** Un élève absent/en retard dans la liste d'une classe (#400). */
export interface AbsentStudentEntry {
  studentId: string;
  studentNom: string;
  status: 'ABSENT' | 'LATE' | 'PRESENT' | 'JUSTIFIED';
  note: string | null;
}

/** Granularité de l'agrégation pour l'évolution du taux de présence/absence (#426, censeur). */
export type AttendanceTrendGranularity = 'DAY' | 'WEEK' | 'MONTH';

/**
 * Une séance (= un créneau précis d'une classe à une date donnée), avec ses
 * compteurs déjà calculés — vue "par créneau" pour le censeur/surveillant
 * général (#426), école entière ou restreinte à une classe. `matiere`/
 * `professeur` sont résolus côté client (le backend ne renvoie que des ids),
 * comme le reste de cet écran.
 */
export interface AttendanceSession {
  id: string;
  classId: string;
  className: string;
  subjectId: string | null;
  matiere: string | null;
  teacherId: string | null;
  professeur: string | null;
  date: string; // dd/mm/yyyy
  dayOfWeek: string;
  period: string; // ex. "08:00-10:00"
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
}

/**
 * Un élève dans le détail d'une séance (#1, censeur) — `absence*` ne sont
 * renseignés que si l'élève est (ou a été) marqué ABSENT sur ce créneau et
 * qu'une demande à justifier existe pour ce couple date/matière ; `null`
 * sinon.
 */
export interface AttendanceSessionStudent {
  studentId: string;
  studentNom: string;
  status: 'ABSENT' | 'LATE' | 'PRESENT' | 'JUSTIFIED';
  note: string | null;
  absenceRequestId: string | null;
  absenceStatus: AbsenceReviewStatus | null;
  absenceReason: string | null;
  hasJustification: boolean;
}

/**
 * Détail complet d'une séance — clic sur un créneau depuis "Par créneau"
 * (#1, censeur) : classe → créneau → liste nommée des élèves, avec pour
 * chaque absent l'état de sa demande à justifier.
 */
export interface AttendanceSessionDetail {
  id: string;
  classId: string;
  className: string;
  subjectId: string | null;
  matiere: string | null;
  teacherId: string | null;
  professeur: string | null;
  date: string; // dd/mm/yyyy
  dayOfWeek: string;
  period: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
  /** Appel verrouillé par la direction : plus modifiable, élève ne peut plus justifier. */
  locked: boolean;
  lockedByNom: string | null;
  lockedAt: string | null;
  students: AttendanceSessionStudent[];
}

/**
 * Un point de la courbe d'évolution du taux de présence/absence — un jour,
 * une semaine (lundi) ou un mois (1er du mois) selon la granularité
 * demandée (#426).
 */
export interface AttendanceTrendPoint {
  periodStart: string; // ISO yyyy-MM-dd
  periodLabel: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
}

export type AbsenceReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'LOCKED';

/**
 * Une demande d'absence à traiter — auto-créée dès que le professeur marque
 * l'élève absent, ou déclarée par l'élève lui-même ; `reason`/`hasJustification`
 * restent vides tant que l'élève n'a pas justifié (#402).
 */
export interface AbsenceRequestSummary {
  id: string;
  studentId: string;
  studentNom: string;
  schoolId: string;
  dateFrom: string; // dd/mm/yyyy
  dateTo: string; // dd/mm/yyyy
  reason: string | null;
  hasJustification: boolean;
  status: AbsenceReviewStatus;
  reviewedBy: string | null;
  /** Nom « Prénom Nom » du personnel qui a traité l'absence (résolu côté client). */
  reviewedByNom: string | null;
  reviewedAt: string | null;
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

export type GradeDisputeStatus =
  | 'pending_teacher'
  | 'pending_supervisor'
  | 'pending_director'
  | 'pending_teacher_directed'
  | 'resolved_approved'
  | 'resolved_rejected';

export interface GradeDisputeHistoryEntry {
  action: string;
  actorId: string;
  actorRole: string;
  comment: string | null;
  at: string;
}

/** Réclamation de note en attente du directeur (seul niveau traité par cette
 * application — le professeur et le surveillant général/censeur statuent
 * depuis leurs propres écrans). */
export interface GradeDispute {
  id: string;
  gradeId: string;
  studentId: string;
  studentNom: string;
  classId: string;
  classNom: string;
  subjectId: string;
  subjectNom: string;
  teacherId: string;
  teacherNom: string;
  disputedValue: number;
  currentValue: number | null;
  reason: string;
  status: GradeDisputeStatus;
  history: GradeDisputeHistoryEntry[];
  createdAt: string;
  resolvedAt: string | null;
}

export interface LeaveRequest {
  id: string;
  teacherId: string;
  teacherNom: string;
  dateDebut: string;
  dateFin: string;
  motif: string;
  statut: LeaveStatus;
  /** Nom du remplaçant proposé, pour affichage. */
  remplacant: string | null;
  /**
   * Id du remplaçant proposé -- requis par le serveur pour approuver (voir
   * `LeavesPort.review`) ; `null` si l'enseignant n'en a proposé aucun, `undefined`
   * pour les sources qui ne distinguent pas id et nom (mock).
   */
  remplacantId?: string | null;
  pieceJointe: { nom: string } | null;
  /** Toutes les pièces jointes (`pieceJointe` ci-dessus n'en affiche que la première) -- pour l'écran de détails. */
  piecesJointes: { nom: string }[];
  /** Nom de qui a traité la demande -- `null` tant qu'elle est en attente. */
  traitePar: string | null;
  /** Date de traitement (approbation/rejet), formatée -- `null` tant qu'en attente. */
  traiteLe: string | null;
  /** Motif de rejet, ou note laissée par le directeur -- `null` si absent. */
  noteDecision: string | null;
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
}

export type DocumentTargetKind = 'eleve' | 'personnel';

export interface SignedDocument {
  serie: string;
  type: string; // "Bulletin — 1er trimestre", "Attestation de travail"…
  cible: string; // nom lisible de la personne concernée
  cibleKind: DocumentTargetKind;
  date: string;
  signataire: string;
  /** URL présignée (1h) du PDF signé -- `null` si indisponible (document importé, ou présignature expirée). */
  downloadUrl: string | null;
  /**
   * CORRECTION (bug signalé) : hash de signature, nécessaire pour appeler
   * `GET /api/v1/signatures/{signatureHash}/download` -- le téléchargement
   * réel se fait désormais par ce flux (fetch + Blob, comme le bouton
   * "Télécharger" des bulletins), plutôt que par un lien direct vers
   * `downloadUrl` (conservé pour compat mais plus utilisé par les écrans).
   * `null` pour un document importé (pas de `SignRequest`, voir `importToSign`).
   */
  signatureHash?: string | null;
  /**
   * Identifiant brut de la personne concernée par le document (`documentRef`
   * côté signature-service) — `null` pour un document importé (pas de
   * `SignRequest`). Permet aux écrans (ex. Résultats & bulletins) de savoir
   * SANS appel supplémentaire si LE bulletin d'UN élève précis est déjà
   * signé, sans dépendre du libellé `cible` (nom affiché, pas un id).
   */
  documentRef?: string | null;
  /** Semestre concerné si applicable (bulletin) — `null` sinon. */
  semesterNumber?: number | null;
  /**
   * SIGNATURE (signature manuscrite + électronique) ou CACHET (tampon
   * seul, sans valeur cryptographique) -- deux actions indépendantes.
   * `null`/absent pour un document importé ou antérieur à cette
   * distinction (traité comme SIGNATURE).
   */
  action?: 'SIGNATURE' | 'CACHET' | null;
}

/**
 * Tampon + signature manuscrite DU SIGNATAIRE CONNECTÉ (task #230) — un
 * seul jeu par signataire (directeur, censeur, surveillant général…),
 * réutilisé automatiquement à chaque signature électronique de bulletin.
 */
export interface SignerAssets {
  hasStamp: boolean;
  hasSignature: boolean;
  /** URL présignée (1h) — `null` si non enregistré. */
  stampPreviewUrl: string | null;
  signaturePreviewUrl: string | null;
}

export interface BulletinPeriod {
  /** `t${AcademicPeriod.number}` -- generalise a semestre/trimestre/annuel,
   *  pas seulement 3 trimestres (voir AcademicYearConfig.periodType). */
  key: string;
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

// ── Transfert interne (task #214/#215) — élève d'une classe à l'autre de la
// MÊME école, avec report des notes. Distinct de TransferRequest ci-dessus
// (qui modélise une DEMANDE, pour le transfert externe) : le transfert
// interne est exécuté directement par le directeur, sans étape d'attente.

/** Matière présente dans les deux classes — se reporte automatiquement avec le coefficient de la classe d'arrivée. */
export interface InternalTransferMatchedSubject {
  subjectId: string;
  subjectNom: string;
  coefficientDepart: number;
  coefficientArrivee: number;
}

/** Matière de la classe de départ sans équivalent dans la classe d'arrivée — reste en historique, sauf mapping choisi. */
export interface InternalTransferOrphanSubject {
  subjectId: string;
  subjectNom: string;
  coefficientDepart: number;
  aDesNotes: boolean;
}

/** Matière de la classe d'arrivée sans équivalent dans la classe de départ — proposable en remplacement d'une orpheline. */
export interface InternalTransferCandidateSubject {
  subjectId: string;
  subjectNom: string;
  coefficientArrivee: number;
}

export interface InternalTransferPreview {
  studentId: string;
  fromClassId: string;
  toClassId: string;
  matieresCommunes: InternalTransferMatchedSubject[];
  matieresOrphelines: InternalTransferOrphanSubject[];
  matieresCandidates: InternalTransferCandidateSubject[];
  /** true si aucune matière orpheline — l'étape de mapping peut être sautée. */
  cheminSansMappingNecessaire: boolean;
}

/** Un choix de remplacement pour une matière orpheline, saisi par le directeur avant exécution. */
export interface InternalTransferMapping {
  matiereOrphelineId: string;
  matiereRemplacementId: string;
  /** Note dans la matière de remplacement — laissée vide : aucune moyenne créée (F-PED-5, matière non notée). */
  note: number | null;
  /** Obligatoire seulement si `note` est renseignée. */
  semestre: number | null;
}

export interface InternalTransferResult {
  matieresReportees: number;
  matieresExclues: number;
  matieresCreees: number;
}

// ── Salles de classe (task #217) ────────────────────────────────────────

export interface ClassRoom {
  id: string;
  nom: string;
  /** 0 = non renseignée. */
  capacite: number;
  /** Classe liée à la création (nouvelle demande direction) — `undefined` si aucune. */
  classeId?: string;
}

/** Disponibilité d'une salle pour un créneau donné (récurrent ou ponctuel) — voir `RoomsPort.checkAvailability`. */
export interface RoomAvailability {
  salleId: string;
  salleNom: string;
  capacite: number;
  disponible: boolean;
  /** null si disponible — sinon un repère lisible de ce qui l'occupe déjà. */
  raisonConflit: string | null;
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

/**
 * Décision forcée pour un élève à la clôture de l'année (task #234) —
 * typiquement un passage exceptionnel malgré une moyenne annuelle
 * insuffisante. `moyenneAnnuelle` est reportée telle que déjà calculée
 * (jamais resaisie ici) ; seule `decision` diffère de celle que le calcul
 * automatique aurait retenue.
 */
export interface PromotionOverride {
  studentId: string;
  classId: string;
  moyenneAnnuelle: number;
  decision: PromotionResult;
  note: string;
}

export interface AnnualFigure {
  valeurActuelle: number;
  /** `null` si aucune année précédente n'existe encore pour cette école. */
  valeurPrecedente: number | null;
  /** Points de pourcentage de variation, arrondis à une décimale — `null` si pas de comparaison possible. */
  variationPct: number | null;
}

/** Tâche #237 — bilan de l'année en cours comparé à l'année précédente (si elle existe). */
export interface BilanAnnuel {
  anneeActuelle: string;
  anneePrecedente: string | null;
  effectif: AnnualFigure;
  recettes: AnnualFigure;
  depenses: AnnualFigure;
  solde: AnnualFigure;
  /** % d'élèves admis (admis + admis_exceptionnel) sur l'ensemble des résultats annuels calculés. */
  tauxReussite: AnnualFigure;
  /** % moyen sur toute l'année scolaire (bornée à aujourd'hui si l'année est en cours). */
  tauxPresence: AnnualFigure;
}

export interface DashboardSnapshot {
  effectifTotal: number;
  effectifGarcons: number;
  effectifFilles: number;
  presenceDuJour: number; // %
  /** Points de %, par rapport à la veille — peut être négatif. */
  presenceDuJourVariation: number;
  demandesEnAttente: number;
  classesCount: number;
  enseignantsCount: number;
}

export interface DirectorProfile {
  id: string;
  prenom: string;
  nom: string;
  /** Application censeur : les deux rôles sont le même métier selon le type d'école (lycée = CENSEUR, collège/primaire = SUPERVISOR). */
  role: 'SUPERVISOR' | 'CENSEUR';
  email: string;
  photoUrl: string | null;
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
// Dépenses — demande de paiement générale (task #218).
// ════════════════════════════════════════════════════════════════════════

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
  validatorRole: string;
  decision: ExpenseDecision;
  commentaire: string | null;
  decideLe: string; // dd/mm/yyyy hh:mm
}

/**
 * Demande de paiement générale — traduit `ExpenseResponse`
 * (`ExpenseController`, payment-service). Côté direction : création
 * uniquement (voir `ExpensesPort`) — la soumission au circuit de
 * validation et la décision finale reviennent au comptable
 * (`apps/comptable`, voir son `ExpensesPort` complet).
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
  valideLe: string | null;
  motifRejet: string | null;
  piecesJointes: string[];
  historiqueValidation: ExpenseValidationStep[];
  creeLe: string;
}
