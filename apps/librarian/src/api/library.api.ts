import { request } from '@/api/client';
import type { LibraryPort, LoanFilter } from '@/services/ports';
import type {
  Borrower,
  BorrowerType,
  Copy,
  CopyState,
  LibraryPolicy,
  LibraryStats,
  Loan,
  LoanStatus,
  Reservation,
  Work,
  WorkType,
} from '@/types/domain';

// ── DTOs (sous-ensembles des réponses du library-service) ───────────────────
interface Page<T> {
  content: T[];
}
type ApiWorkType = 'BOOK' | 'TEXTBOOK' | 'REFERENCE' | 'THESIS' | 'REPORT' | 'PERIODICAL' | 'MULTIMEDIA' | 'OTHER';
type ApiCopyStatus = 'AVAILABLE' | 'ON_LOAN' | 'RESERVED' | 'IN_REPAIR' | 'LOST' | 'WITHDRAWN';
type ApiLoanStatus = 'ACTIVE' | 'RETURNED' | 'LOST';
type ApiBorrowerType = 'STUDENT' | 'TEACHER' | 'STAFF';
type ApiReservationStatus = 'PENDING' | 'READY' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

interface WorkDto {
  id: string;
  type: ApiWorkType;
  title: string;
  authors?: string[];
  isbn?: string | null;
  publicationYear?: number | null;
  subjectName?: string | null;
  hasCover?: boolean;
  totalCopies: number;
  availableCopies: number;
}
interface CopyDto {
  id: string;
  workId: string;
  barcode: string;
  status: ApiCopyStatus;
}
interface LoanDto {
  id: string;
  barcode: string;
  workTitle: string;
  borrowerId: string;
  borrowerName: string;
  borrowerType: ApiBorrowerType;
  status: ApiLoanStatus;
  loanedAt: string;
  dueDate: string;
  returnedAt?: string | null;
  renewalCount: number;
  overdue?: boolean | null;
}
interface ReservationDto {
  id: string;
  workTitle: string;
  borrowerName: string;
  requestedAt: string;
  status: ApiReservationStatus;
}
interface StatsDto {
  works: number;
  copies: number;
  activeLoans: number;
  overdueLoans: number;
  pendingReservations: number;
}
interface BorrowRuleDto {
  loanDays: number;
  maxActiveLoans: number;
  maxRenewals: number;
  renewalDays: number;
}
interface PolicyDto {
  rules: Partial<Record<ApiBorrowerType, BorrowRuleDto>>;
  reminderDaysBefore?: number[];
  overdueReminderEveryDays: number;
  reservationHoldDays: number;
  blockBorrowingWhenOverdue: boolean;
}

// ── Mappers ─────────────────────────────────────────────────────────────────
const WORK_TYPE_FROM: Record<ApiWorkType, WorkType> = {
  BOOK: 'livre',
  TEXTBOOK: 'manuel',
  REFERENCE: 'autre',
  THESIS: 'memoire',
  REPORT: 'memoire',
  PERIODICAL: 'periodique',
  MULTIMEDIA: 'autre',
  OTHER: 'autre',
};
const WORK_TYPE_TO: Record<WorkType, ApiWorkType> = {
  livre: 'BOOK',
  manuel: 'TEXTBOOK',
  memoire: 'THESIS',
  periodique: 'PERIODICAL',
  autre: 'OTHER',
};
const COPY_STATE_FROM: Record<ApiCopyStatus, CopyState> = {
  AVAILABLE: 'disponible',
  ON_LOAN: 'emprunte',
  RESERVED: 'reserve',
  IN_REPAIR: 'abime',
  LOST: 'perdu',
  WITHDRAWN: 'abime',
};
const BORROWER_FROM: Record<ApiBorrowerType, BorrowerType> = { STUDENT: 'eleve', TEACHER: 'enseignant', STAFF: 'personnel' };
const BORROWER_TO: Record<BorrowerType, ApiBorrowerType> = { eleve: 'STUDENT', enseignant: 'TEACHER', personnel: 'STAFF' };

function fromWork(d: WorkDto): Work {
  return {
    id: d.id,
    titre: d.title,
    auteur: (d.authors ?? []).join(', ') || '—',
    isbn: d.isbn ?? null,
    type: WORK_TYPE_FROM[d.type] ?? 'autre',
    categorie: d.subjectName ?? '—',
    annee: d.publicationYear ?? null,
    totalCopies: d.totalCopies,
    availableCopies: d.availableCopies,
    coverUrl: null,
  };
}
function fromCopy(d: CopyDto): Copy {
  return { id: d.id, workId: d.workId, barcode: d.barcode, etat: COPY_STATE_FROM[d.status] ?? 'disponible' };
}
function loanStatus(d: LoanDto): LoanStatus {
  if (d.status === 'RETURNED') return 'rendu';
  if (d.status === 'LOST') return 'perdu';
  return d.overdue ? 'en_retard' : 'en_cours';
}
function fromLoan(d: LoanDto): Loan {
  return {
    id: d.id,
    workTitre: d.workTitle,
    copyBarcode: d.barcode,
    emprunteurNom: d.borrowerName,
    emprunteurType: BORROWER_FROM[d.borrowerType] ?? 'eleve',
    dateEmprunt: (d.loanedAt ?? '').slice(0, 10),
    dateRetourPrevue: d.dueDate,
    dateRetourEffective: d.returnedAt ? d.returnedAt.slice(0, 10) : null,
    renouvellements: d.renewalCount ?? 0,
    statut: loanStatus(d),
  };
}
function fromReservation(d: ReservationDto): Reservation {
  const statut = d.status === 'FULFILLED' ? 'honoree' : d.status === 'PENDING' || d.status === 'READY' ? 'active' : 'annulee';
  return { id: d.id, workTitre: d.workTitle, emprunteurNom: d.borrowerName, dateReservation: (d.requestedAt ?? '').slice(0, 10), statut };
}

export function createLibraryApi(): LibraryPort {
  return {
    async getStats(): Promise<LibraryStats> {
      const [stats, loans] = await Promise.all([
        request<StatsDto>('/api/v1/library/stats'),
        request<Page<LoanDto>>('/api/v1/library/loans', { query: { status: 'ACTIVE', size: 200 } }),
      ]);
      const members = new Set((loans.content ?? []).map((l) => l.borrowerId));
      return {
        totalWorks: stats.works,
        totalCopies: stats.copies,
        loansActive: stats.activeLoans,
        loansOverdue: stats.overdueLoans,
        reservationsActive: stats.pendingReservations,
        membersActive: members.size,
      };
    },

    async listWorks(search?): Promise<Work[]> {
      const page = await request<Page<WorkDto>>('/api/v1/library/works', {
        query: { q: search?.trim() || undefined, size: 100 },
      });
      return (page.content ?? []).map(fromWork);
    },
    async getWork(id): Promise<Work> {
      return fromWork(await request<WorkDto>(`/api/v1/library/works/${encodeURIComponent(id)}`));
    },
    async createWork(input): Promise<Work> {
      const created = await request<WorkDto>('/api/v1/library/works', {
        method: 'POST',
        body: {
          type: WORK_TYPE_TO[input.type],
          title: input.titre,
          authors: input.auteur ? [input.auteur] : [],
          isbn: input.isbn || undefined,
          publicationYear: input.annee,
          subjectName: input.categorie,
        },
      });
      if (input.copies > 0) {
        await request<CopyDto[]>(`/api/v1/library/works/${encodeURIComponent(created.id)}/copies`, {
          method: 'POST',
          body: { count: input.copies, condition: 'GOOD' },
        });
      }
      return fromWork(await request<WorkDto>(`/api/v1/library/works/${encodeURIComponent(created.id)}`));
    },
    async updateWork(id, patch): Promise<Work> {
      const current = await request<WorkDto>(`/api/v1/library/works/${encodeURIComponent(id)}`);
      const updated = await request<WorkDto>(`/api/v1/library/works/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: {
          type: WORK_TYPE_TO[patch.type ?? WORK_TYPE_FROM[current.type] ?? 'autre'],
          title: patch.titre ?? current.title,
          authors: patch.auteur !== undefined ? [patch.auteur] : current.authors ?? [],
          isbn: patch.isbn !== undefined ? patch.isbn ?? undefined : current.isbn ?? undefined,
          publicationYear: patch.annee !== undefined ? patch.annee ?? undefined : current.publicationYear ?? undefined,
          subjectName: patch.categorie ?? current.subjectName ?? undefined,
        },
      });
      return fromWork(updated);
    },
    async archiveWork(id): Promise<void> {
      await request<unknown>(`/api/v1/library/works/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    async listCopies(workId): Promise<Copy[]> {
      const copies = await request<CopyDto[]>(`/api/v1/library/works/${encodeURIComponent(workId)}/copies`);
      return copies.map(fromCopy);
    },
    async addCopies(workId, count): Promise<Copy[]> {
      const copies = await request<CopyDto[]>(`/api/v1/library/works/${encodeURIComponent(workId)}/copies`, {
        method: 'POST',
        body: { count, condition: 'GOOD' },
      });
      return copies.map(fromCopy);
    },

    async listLoans(filter: LoanFilter): Promise<Loan[]> {
      const query: Record<string, string | number | undefined> = { size: 100 };
      if (filter === 'en_cours') query.status = 'ACTIVE';
      if (filter === 'retard') {
        query.status = 'ACTIVE';
        query.overdueOnly = 'true';
      }
      const page = await request<Page<LoanDto>>('/api/v1/library/loans', { query });
      return (page.content ?? []).map(fromLoan);
    },
    async lend(input): Promise<Loan> {
      // NOTE : le backend exige un `borrowerId` (compte utilisateur). Faute d'un
      // sélecteur d'adhérent dans cette vue, on transmet le nom saisi comme
      // identifiant — à remplacer par une recherche d'adhérent (user-service)
      // pour la mise en production.
      const dto = await request<LoanDto>('/api/v1/library/loans', {
        method: 'POST',
        body: {
          barcode: input.barcode,
          borrowerId: input.emprunteurNom,
          borrowerType: BORROWER_TO[input.emprunteurType],
          borrowerName: input.emprunteurNom,
        },
      });
      return fromLoan(dto);
    },
    async returnLoan(loanId): Promise<Loan> {
      return fromLoan(
        await request<LoanDto>(`/api/v1/library/loans/${encodeURIComponent(loanId)}/return`, {
          method: 'POST',
          body: { condition: 'GOOD' },
        }),
      );
    },
    async renewLoan(loanId): Promise<Loan> {
      return fromLoan(await request<LoanDto>(`/api/v1/library/loans/${encodeURIComponent(loanId)}/renew`, { method: 'POST' }));
    },
    async declareLost(loanId): Promise<Loan> {
      return fromLoan(await request<LoanDto>(`/api/v1/library/loans/${encodeURIComponent(loanId)}/lost`, { method: 'POST' }));
    },
    async sendReminder(_loanId): Promise<void> {
      // Pas d'endpoint « rappel immédiat » côté library-service : les rappels
      // sont planifiés par la politique (reminderDaysBefore). No-op ici.
      return Promise.resolve();
    },

    async listBorrowers(search?): Promise<Borrower[]> {
      // Pas d'endpoint « liste des adhérents » : on dérive des emprunts.
      const page = await request<Page<LoanDto>>('/api/v1/library/loans', { query: { size: 200 } });
      const byId = new Map<string, Borrower>();
      for (const l of page.content ?? []) {
        const existing = byId.get(l.borrowerId);
        const active = loanStatus(l) === 'en_cours' || loanStatus(l) === 'en_retard' ? 1 : 0;
        if (existing) {
          existing.empruntsEnCours += active;
          existing.totalEmprunts += 1;
        } else {
          byId.set(l.borrowerId, {
            id: l.borrowerId,
            nom: l.borrowerName,
            type: BORROWER_FROM[l.borrowerType] ?? 'eleve',
            empruntsEnCours: active,
            totalEmprunts: 1,
          });
        }
      }
      let rows = [...byId.values()];
      const q = search?.trim().toLowerCase();
      if (q) rows = rows.filter((b) => b.nom.toLowerCase().includes(q));
      return rows;
    },
    async borrowerHistory(borrowerId): Promise<Loan[]> {
      const page = await request<Page<LoanDto>>(`/api/v1/library/borrowers/${encodeURIComponent(borrowerId)}/history`, {
        query: { size: 100 },
      });
      return (page.content ?? []).map(fromLoan);
    },

    async listReservations(): Promise<Reservation[]> {
      const rows = await request<ReservationDto[]>('/api/v1/library/reservations');
      return rows.map(fromReservation).filter((r) => r.statut === 'active');
    },
    async cancelReservation(id): Promise<void> {
      await request<unknown>(`/api/v1/library/reservations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async getPolicy(): Promise<LibraryPolicy> {
      const p = await request<PolicyDto>('/api/v1/library/policy');
      const student = p.rules.STUDENT;
      const teacher = p.rules.TEACHER;
      return {
        dureeEmpruntJours: student?.loanDays ?? 14,
        quotaEleve: student?.maxActiveLoans ?? 2,
        quotaEnseignant: teacher?.maxActiveLoans ?? 5,
        renouvellementsMax: student?.maxRenewals ?? 1,
        penaliteRetardParJour: 0,
      };
    },
    async updatePolicy(patch): Promise<LibraryPolicy> {
      const current = await request<PolicyDto>('/api/v1/library/policy');
      const student: BorrowRuleDto = current.rules.STUDENT ?? { loanDays: 14, maxActiveLoans: 2, maxRenewals: 1, renewalDays: 7 };
      const teacher: BorrowRuleDto = current.rules.TEACHER ?? { loanDays: 30, maxActiveLoans: 5, maxRenewals: 2, renewalDays: 14 };
      const staff: BorrowRuleDto = current.rules.STAFF ?? { loanDays: 30, maxActiveLoans: 5, maxRenewals: 2, renewalDays: 14 };
      if (patch.dureeEmpruntJours !== undefined) student.loanDays = patch.dureeEmpruntJours;
      if (patch.quotaEleve !== undefined) student.maxActiveLoans = patch.quotaEleve;
      if (patch.quotaEnseignant !== undefined) teacher.maxActiveLoans = patch.quotaEnseignant;
      if (patch.renouvellementsMax !== undefined) {
        student.maxRenewals = patch.renouvellementsMax;
        teacher.maxRenewals = patch.renouvellementsMax;
      }
      await request<PolicyDto>('/api/v1/library/policy', {
        method: 'PUT',
        body: {
          rules: { STUDENT: student, TEACHER: teacher, STAFF: staff },
          reminderDaysBefore: current.reminderDaysBefore ?? [3, 1],
          overdueReminderEveryDays: current.overdueReminderEveryDays ?? 7,
          reservationHoldDays: current.reservationHoldDays ?? 3,
          blockBorrowingWhenOverdue: current.blockBorrowingWhenOverdue ?? false,
        },
      });
      return {
        dureeEmpruntJours: student.loanDays,
        quotaEleve: student.maxActiveLoans,
        quotaEnseignant: teacher.maxActiveLoans,
        renouvellementsMax: student.maxRenewals,
        penaliteRetardParJour: patch.penaliteRetardParJour ?? 0,
      };
    },
  };
}
