import type {
  Borrower,
  BorrowerType,
  Copy,
  LibraryPolicy,
  LibraryStats,
  Loan,
  Reservation,
  School,
  TeacherProfile,
  Work,
  WorkType,
} from '@/types/domain';

export interface AuthPort {
  login(identifier: string, password: string, loginByPhone: boolean): Promise<TeacherProfile>;
  logout(): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
  updateMyPhoto(file: File): Promise<TeacherProfile>;
}

/** Lecture seule — pour le branding de l'établissement. */
export interface SchoolPort {
  getSchool(): Promise<School>;
}

export type LoanFilter = 'en_cours' | 'retard' | 'tous';

export interface LibraryPort {
  getStats(): Promise<LibraryStats>;

  // ── Catalogue ──
  listWorks(search?: string): Promise<Work[]>;
  getWork(id: string): Promise<Work>;
  createWork(input: {
    titre: string;
    auteur: string;
    isbn?: string;
    type: WorkType;
    categorie: string;
    annee?: number;
    copies: number;
  }): Promise<Work>;
  updateWork(id: string, patch: Partial<Pick<Work, 'titre' | 'auteur' | 'isbn' | 'type' | 'categorie' | 'annee'>>): Promise<Work>;
  archiveWork(id: string): Promise<void>;
  listCopies(workId: string): Promise<Copy[]>;
  addCopies(workId: string, count: number): Promise<Copy[]>;

  // ── Emprunts ──
  listLoans(filter: LoanFilter): Promise<Loan[]>;
  lend(input: { barcode: string; emprunteurNom: string; emprunteurType: BorrowerType }): Promise<Loan>;
  returnLoan(loanId: string): Promise<Loan>;
  renewLoan(loanId: string): Promise<Loan>;
  declareLost(loanId: string): Promise<Loan>;
  sendReminder(loanId: string): Promise<void>;

  // ── Adhérents ──
  listBorrowers(search?: string): Promise<Borrower[]>;
  borrowerHistory(borrowerId: string): Promise<Loan[]>;

  // ── Réservations ──
  listReservations(): Promise<Reservation[]>;
  cancelReservation(id: string): Promise<void>;

  // ── Politique de prêt ──
  getPolicy(): Promise<LibraryPolicy>;
  updatePolicy(patch: Partial<LibraryPolicy>): Promise<LibraryPolicy>;
}

export interface Services {
  auth: AuthPort;
  school: SchoolPort;
  library: LibraryPort;
}
