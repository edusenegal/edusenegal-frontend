import { AppError } from '@/services/errors';
import type { LibraryPort, Services } from '@/services/ports';
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

const LATENCY_MS = 260;

function respond<T>(value: T, latency = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(value)), latency);
  });
}

function notFound(what: string): never {
  throw new AppError('notFound', `${what} introuvable.`, 404);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isOverdue(loan: Loan): boolean {
  return loan.statut === 'en_cours' && loan.dateRetourPrevue < todayISO();
}

/** Recalcule le statut « en retard » à la volée (dérivé de la date prévue). */
function withComputedStatus(loan: Loan): Loan {
  if (isOverdue(loan)) return { ...loan, statut: 'en_retard' };
  return loan;
}

const SCHOOL: School = {
  id: 'school-1',
  name: 'Lycée Kocc Barma',
  type: 'LYCEE',
  region: 'Saint-Louis',
  adresse: 'Saint-Louis, Sénégal',
  telephone: '+221 33 961 00 00',
  logoUrl: null,
  primaryColor: '#1f7a5a',
  secondaryColor: '#0f4c3a',
  devise: 'XOF',
};

const PROFILE: TeacherProfile = {
  id: 'lib-1',
  prenom: 'Fatou',
  nom: 'Ba',
  role: 'LIBRARIAN',
  email: 'fatou.ba@lycee-koccbarma.sn',
  tel: '+221 77 000 00 12',
  photoUrl: null,
};

function createInitialState() {
  const works: Work[] = [
    { id: 'w1', titre: "L'Aventure ambiguë", auteur: 'Cheikh Hamidou Kane', isbn: '9782264036513', type: 'livre', categorie: 'Littérature', annee: 1961, totalCopies: 5, availableCopies: 3, coverUrl: null },
    { id: 'w2', titre: 'Mathématiques Terminale S', auteur: 'Collection Excellence', isbn: '9782091234567', type: 'manuel', categorie: 'Mathématiques', annee: 2022, totalCopies: 12, availableCopies: 7, coverUrl: null },
    { id: 'w3', titre: 'Une si longue lettre', auteur: 'Mariama Bâ', isbn: '9782708705043', type: 'livre', categorie: 'Littérature', annee: 1979, totalCopies: 6, availableCopies: 6, coverUrl: null },
    { id: 'w4', titre: 'Physique-Chimie 1ère S', auteur: 'Hachette Éducation', isbn: '9782011355423', type: 'manuel', categorie: 'Sciences', annee: 2021, totalCopies: 10, availableCopies: 4, coverUrl: null },
    { id: 'w5', titre: "Impact du numérique sur l'enseignement au Sénégal", auteur: 'A. Diop', isbn: null, type: 'memoire', categorie: 'Éducation', annee: 2023, totalCopies: 2, availableCopies: 1, coverUrl: null },
  ];

  const [TITRE_AVENTURE, TITRE_MATHS, TITRE_LETTRE, TITRE_PHYSIQUE] = [
    works[0]!.titre,
    works[1]!.titre,
    works[2]!.titre,
    works[3]!.titre,
  ];

  const copies: Copy[] = [];
  for (const w of works) {
    for (let i = 1; i <= w.totalCopies; i++) {
      copies.push({ id: `${w.id}-c${i}`, workId: w.id, barcode: `${w.id.toUpperCase()}-${String(i).padStart(3, '0')}`, etat: 'disponible' });
    }
  }

  const today = todayISO();
  const loans: Loan[] = [
    { id: 'l1', workTitre: TITRE_AVENTURE, copyBarcode: 'W1-001', emprunteurNom: 'Gora Diallo', emprunteurType: 'eleve', dateEmprunt: addDays(today, -5), dateRetourPrevue: addDays(today, 9), dateRetourEffective: null, renouvellements: 0, statut: 'en_cours' },
    { id: 'l2', workTitre: TITRE_MATHS, copyBarcode: 'W2-003', emprunteurNom: 'Awa Ndiaye', emprunteurType: 'enseignant', dateEmprunt: addDays(today, -20), dateRetourPrevue: addDays(today, -6), dateRetourEffective: null, renouvellements: 1, statut: 'en_cours' },
    { id: 'l3', workTitre: TITRE_PHYSIQUE, copyBarcode: 'W4-002', emprunteurNom: 'Modou Sarr', emprunteurType: 'eleve', dateEmprunt: addDays(today, -14), dateRetourPrevue: addDays(today, -2), dateRetourEffective: null, renouvellements: 0, statut: 'en_cours' },
    { id: 'l4', workTitre: TITRE_LETTRE, copyBarcode: 'W3-001', emprunteurNom: 'Bineta Fall', emprunteurType: 'eleve', dateEmprunt: addDays(today, -30), dateRetourPrevue: addDays(today, -16), dateRetourEffective: addDays(today, -15), renouvellements: 0, statut: 'rendu' },
  ];

  const reservations: Reservation[] = [
    { id: 'r1', workTitre: TITRE_MATHS, emprunteurNom: 'Seydou Ba', dateReservation: addDays(today, -1), statut: 'active' },
    { id: 'r2', workTitre: TITRE_PHYSIQUE, emprunteurNom: 'Aissatou Sow', dateReservation: addDays(today, -3), statut: 'active' },
  ];

  const borrowers: Borrower[] = [
    { id: 'b1', nom: 'Gora Diallo', type: 'eleve', empruntsEnCours: 1, totalEmprunts: 7 },
    { id: 'b2', nom: 'Awa Ndiaye', type: 'enseignant', empruntsEnCours: 1, totalEmprunts: 23 },
    { id: 'b3', nom: 'Modou Sarr', type: 'eleve', empruntsEnCours: 1, totalEmprunts: 4 },
    { id: 'b4', nom: 'Bineta Fall', type: 'eleve', empruntsEnCours: 0, totalEmprunts: 11 },
  ];

  const policy: LibraryPolicy = {
    dureeEmpruntJours: 14,
    quotaEleve: 2,
    quotaEnseignant: 5,
    renouvellementsMax: 2,
    penaliteRetardParJour: 100,
  };

  return { works, copies, loans, reservations, borrowers, policy };
}

export function createMockServices(): Services {
  const state = createInitialState();

  const library: LibraryPort = {
    async getStats(): Promise<LibraryStats> {
      const loans = state.loans.map(withComputedStatus);
      return respond({
        totalWorks: state.works.length,
        totalCopies: state.copies.length,
        loansActive: loans.filter((l) => l.statut === 'en_cours' || l.statut === 'en_retard').length,
        loansOverdue: loans.filter((l) => l.statut === 'en_retard').length,
        reservationsActive: state.reservations.filter((r) => r.statut === 'active').length,
        membersActive: state.borrowers.filter((b) => b.empruntsEnCours > 0).length,
      });
    },

    async listWorks(search?: string): Promise<Work[]> {
      const q = search?.trim().toLowerCase();
      const rows = q
        ? state.works.filter((w) => `${w.titre} ${w.auteur} ${w.categorie}`.toLowerCase().includes(q))
        : state.works;
      return respond(rows);
    },
    async getWork(id): Promise<Work> {
      const w = state.works.find((x) => x.id === id);
      if (!w) notFound('Œuvre');
      return respond(w);
    },
    async createWork(input): Promise<Work> {
      const id = `w${Date.now()}`;
      const w: Work = {
        id,
        titre: input.titre,
        auteur: input.auteur,
        isbn: input.isbn || null,
        type: input.type,
        categorie: input.categorie,
        annee: input.annee ?? null,
        totalCopies: input.copies,
        availableCopies: input.copies,
        coverUrl: null,
      };
      state.works.unshift(w);
      for (let i = 1; i <= input.copies; i++) {
        state.copies.push({ id: `${id}-c${i}`, workId: id, barcode: `${id.toUpperCase()}-${String(i).padStart(3, '0')}`, etat: 'disponible' });
      }
      return respond(w, 320);
    },
    async updateWork(id, patch): Promise<Work> {
      const w = state.works.find((x) => x.id === id);
      if (!w) notFound('Œuvre');
      Object.assign(w, patch);
      return respond(w);
    },
    async archiveWork(id): Promise<void> {
      state.works = state.works.filter((w) => w.id !== id);
      state.copies = state.copies.filter((c) => c.workId !== id);
      await respond(undefined, 280);
    },
    async listCopies(workId): Promise<Copy[]> {
      return respond(state.copies.filter((c) => c.workId === workId));
    },
    async addCopies(workId, count): Promise<Copy[]> {
      const w = state.works.find((x) => x.id === workId);
      if (!w) notFound('Œuvre');
      const existing = state.copies.filter((c) => c.workId === workId).length;
      const added: Copy[] = [];
      for (let i = 1; i <= count; i++) {
        const n = existing + i;
        const c: Copy = { id: `${workId}-c${n}`, workId, barcode: `${workId.toUpperCase()}-${String(n).padStart(3, '0')}`, etat: 'disponible' };
        state.copies.push(c);
        added.push(c);
      }
      w.totalCopies += count;
      w.availableCopies += count;
      return respond(added, 300);
    },

    async listLoans(filter): Promise<Loan[]> {
      let rows = state.loans.map(withComputedStatus);
      if (filter === 'en_cours') rows = rows.filter((l) => l.statut === 'en_cours' || l.statut === 'en_retard');
      else if (filter === 'retard') rows = rows.filter((l) => l.statut === 'en_retard');
      return respond(rows);
    },
    async lend(input): Promise<Loan> {
      const copy = state.copies.find((c) => c.barcode === input.barcode);
      if (!copy) notFound('Exemplaire (code-barres)');
      if (copy.etat !== 'disponible') {
        throw new AppError('validation', `L'exemplaire ${input.barcode} n'est pas disponible (${copy.etat}).`, 409);
      }
      const work = state.works.find((w) => w.id === copy.workId);
      if (!work) notFound('Œuvre');
      copy.etat = 'emprunte';
      work.availableCopies = Math.max(0, work.availableCopies - 1);
      const today = todayISO();
      const loan: Loan = {
        id: `l${Date.now()}`,
        workTitre: work.titre,
        copyBarcode: copy.barcode,
        emprunteurNom: input.emprunteurNom,
        emprunteurType: input.emprunteurType,
        dateEmprunt: today,
        dateRetourPrevue: addDays(today, state.policy.dureeEmpruntJours),
        dateRetourEffective: null,
        renouvellements: 0,
        statut: 'en_cours',
      };
      state.loans.unshift(loan);
      return respond(loan, 320);
    },
    async returnLoan(loanId): Promise<Loan> {
      const loan = state.loans.find((l) => l.id === loanId);
      if (!loan) notFound('Emprunt');
      loan.dateRetourEffective = todayISO();
      loan.statut = 'rendu';
      const copy = state.copies.find((c) => c.barcode === loan.copyBarcode);
      if (copy) copy.etat = 'disponible';
      const work = copy ? state.works.find((w) => w.id === copy.workId) : undefined;
      if (work) work.availableCopies += 1;
      return respond(loan, 300);
    },
    async renewLoan(loanId): Promise<Loan> {
      const loan = state.loans.find((l) => l.id === loanId);
      if (!loan) notFound('Emprunt');
      if (loan.renouvellements >= state.policy.renouvellementsMax) {
        throw new AppError('validation', `Nombre maximal de renouvellements atteint (${state.policy.renouvellementsMax}).`, 409);
      }
      loan.renouvellements += 1;
      loan.dateRetourPrevue = addDays(todayISO(), state.policy.dureeEmpruntJours);
      loan.statut = 'en_cours';
      return respond(loan, 300);
    },
    async declareLost(loanId): Promise<Loan> {
      const loan = state.loans.find((l) => l.id === loanId);
      if (!loan) notFound('Emprunt');
      loan.statut = 'perdu';
      const copy = state.copies.find((c) => c.barcode === loan.copyBarcode);
      if (copy) copy.etat = 'perdu';
      return respond(loan, 300);
    },
    async sendReminder(loanId): Promise<void> {
      const loan = state.loans.find((l) => l.id === loanId);
      if (!loan) notFound('Emprunt');
      await respond(undefined, 250);
    },

    async listBorrowers(search?): Promise<Borrower[]> {
      const q = search?.trim().toLowerCase();
      const rows = q ? state.borrowers.filter((b) => b.nom.toLowerCase().includes(q)) : state.borrowers;
      return respond(rows);
    },
    async borrowerHistory(borrowerId): Promise<Loan[]> {
      const b = state.borrowers.find((x) => x.id === borrowerId);
      if (!b) notFound('Adhérent');
      return respond(state.loans.filter((l) => l.emprunteurNom === b.nom).map(withComputedStatus));
    },

    async listReservations(): Promise<Reservation[]> {
      return respond(state.reservations.filter((r) => r.statut === 'active'));
    },
    async cancelReservation(id): Promise<void> {
      const r = state.reservations.find((x) => x.id === id);
      if (!r) notFound('Réservation');
      r.statut = 'annulee';
      await respond(undefined, 250);
    },

    async getPolicy(): Promise<LibraryPolicy> {
      return respond(state.policy);
    },
    async updatePolicy(patch): Promise<LibraryPolicy> {
      Object.assign(state.policy, patch);
      return respond(state.policy, 300);
    },
  };

  return {
    auth: {
      async login(identifier: string, password: string, _loginByPhone: boolean): Promise<TeacherProfile> {
        if (!identifier.trim() || password.length < 4) {
          throw new AppError('unauthorized', 'Identifiant ou mot de passe incorrect.', 401);
        }
        return respond(PROFILE, 360);
      },
      async logout(): Promise<void> {
        await respond(undefined, 80);
      },
      async updateMyPhoto(_file: File): Promise<TeacherProfile> {
        return respond(PROFILE, 200);
      },
      async changePassword(newPassword: string): Promise<void> {
        if (newPassword.length < 4) {
          throw new AppError('validation', 'Le mot de passe doit contenir au moins 4 caractères.', 400);
        }
        await respond(undefined, 200);
      },
    },
    school: {
      async getSchool(): Promise<School> {
        return respond(SCHOOL);
      },
    },
    library,
  };
}

// réexport pour d'éventuels usages de typage externes
export type { BorrowerType, WorkType };
