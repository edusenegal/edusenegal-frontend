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
  matiere: string | null;
  date: string; // dd/mm/yyyy
  notes: string;
}

export type ScheduleSlotKind = 'cours' | 'permanence' | 'libre';

export interface ScheduleSlot {
  jour: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi';
  heureDebut: string; // "08:00"
  heureFin: string;
  matiere: string | null;
  enseignantId: string | null;
  salle: string | null;
  kind: ScheduleSlotKind;
}

export type StaffStatus = 'actif' | 'en_conge';

export interface Teacher {
  id: string;
  nom: string;
  matiere: string;
  tel: string;
  email: string;
  statut: StaffStatus;
  classes: string[]; // noms de classes, ex. "Terminale S2"
  salaire: number;
}

export interface SalarySlip {
  id: string;
  teacherId: string;
  mois: string; // "Septembre 2026"
  montant: number;
  datePaiement: string; // dd/mm/yyyy
  statut: 'payé' | 'en_attente';
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
  level: string;
  series: string | null;
  displayName: string;
  inscriptionFcfa: number;
  periodFcfa: number;
  totalAnnualFcfa: number;
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

export type SalaryRequestStatus = 'en_attente' | 'validee' | 'payee';

export interface SalaryRequest {
  id: string;
  teacherId: string;
  teacherNom: string;
  mois: string; // "Octobre 2026"
  montant: number;
  statut: SalaryRequestStatus;
  dateCreation: string;
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
