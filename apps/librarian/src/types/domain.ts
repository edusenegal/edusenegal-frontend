export type SchoolType = 'PRIMAIRE' | 'COLLEGE' | 'LYCEE' | 'UNIVERSITE';

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
  devise: string;
}

/**
 * Profil de l'utilisateur connecté (ici, le bibliothécaire). Le nom du type
 * reste `TeacherProfile` par compatibilité avec `stores/auth.store` et la
 * barre latérale, partagés tels quels entre les espaces.
 */
export interface TeacherProfile {
  id: string;
  prenom: string;
  nom: string;
  role: string;
  email: string;
  tel: string | null;
  photoUrl: string | null;
}

// ── Domaine bibliothèque ────────────────────────────────────────────────────

export type WorkType = 'livre' | 'manuel' | 'memoire' | 'periodique' | 'autre';

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  livre: 'Livre',
  manuel: 'Manuel scolaire',
  memoire: 'Mémoire / Thèse',
  periodique: 'Périodique',
  autre: 'Autre',
};

export interface Work {
  id: string;
  titre: string;
  auteur: string;
  isbn: string | null;
  type: WorkType;
  categorie: string;
  annee: number | null;
  totalCopies: number;
  availableCopies: number;
  coverUrl: string | null;
}

export type CopyState = 'disponible' | 'emprunte' | 'reserve' | 'perdu' | 'abime';

export interface Copy {
  id: string;
  workId: string;
  barcode: string;
  etat: CopyState;
}

export type BorrowerType = 'eleve' | 'enseignant' | 'personnel';

export const BORROWER_TYPE_LABEL: Record<BorrowerType, string> = {
  eleve: 'Élève',
  enseignant: 'Enseignant',
  personnel: 'Personnel',
};

export type LoanStatus = 'en_cours' | 'rendu' | 'en_retard' | 'perdu';

export interface Loan {
  id: string;
  workTitre: string;
  copyBarcode: string;
  emprunteurNom: string;
  emprunteurType: BorrowerType;
  dateEmprunt: string;
  dateRetourPrevue: string;
  dateRetourEffective: string | null;
  renouvellements: number;
  statut: LoanStatus;
}

export interface Borrower {
  id: string;
  nom: string;
  type: BorrowerType;
  empruntsEnCours: number;
  totalEmprunts: number;
}

export type ReservationStatus = 'active' | 'annulee' | 'honoree';

export interface Reservation {
  id: string;
  workTitre: string;
  emprunteurNom: string;
  dateReservation: string;
  statut: ReservationStatus;
}

export interface LibraryPolicy {
  dureeEmpruntJours: number;
  quotaEleve: number;
  quotaEnseignant: number;
  renouvellementsMax: number;
  penaliteRetardParJour: number;
}

export interface LibraryStats {
  totalWorks: number;
  totalCopies: number;
  loansActive: number;
  loansOverdue: number;
  reservationsActive: number;
  membersActive: number;
}
