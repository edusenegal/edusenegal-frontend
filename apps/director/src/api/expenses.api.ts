import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type { ApiExpenseCategory, ApiPage, CreateExpenseRequestDto, ExpenseResponseDto } from '@/types/api';
import type { ExpensesPort } from '@/services/ports';
import type { Expense, ExpenseCategory } from '@/types/domain';
import { isoToFR, frToISO } from '@/utils/format';

const CATEGORY_TO_API: Record<ExpenseCategory, ApiExpenseCategory> = {
  salaires: 'SALAIRES',
  fournitures_bureau: 'FOURNITURES_BUREAU',
  materiel_pedagogique: 'MATERIEL_PEDAGOGIQUE',
  electricite: 'ELECTRICITE',
  eau: 'EAU',
  internet: 'INTERNET',
  loyer: 'LOYER',
  maintenance: 'MAINTENANCE',
  transport: 'TRANSPORT',
  communication: 'COMMUNICATION',
  frais_bancaires: 'FRAIS_BANCAIRES',
  autres: 'AUTRES',
};
const CATEGORY_FROM_API: Record<ApiExpenseCategory, ExpenseCategory> = Object.fromEntries(
  Object.entries(CATEGORY_TO_API).map(([fr, api]) => [api, fr]),
) as Record<ApiExpenseCategory, ExpenseCategory>;

const STATUS_FROM_API = {
  DRAFT: 'brouillon',
  PENDING_VALIDATION: 'en_attente',
  VALIDATED: 'validee',
  REJECTED: 'rejetee',
  CANCELLED: 'annulee',
} as const;

const DECISION_FROM_API = { APPROVED: 'approuve', REJECTED: 'rejete' } as const;

/** "2026-11-05T10:30:00" → "05/11/2026 10:30". */
function isoDateTimeToFR(iso: string | null): string | null {
  if (!iso) return null;
  const timePart = iso.slice(11, 16);
  return timePart ? `${isoToFR(iso.slice(0, 10))} ${timePart}` : isoToFR(iso.slice(0, 10));
}

function fromApiExpense(dto: ExpenseResponseDto): Expense {
  return {
    id: dto.id,
    schoolId: dto.schoolId,
    academicYearId: dto.academicYearId,
    categorie: CATEGORY_FROM_API[dto.category] ?? 'autres',
    libelle: dto.label,
    montantFcfa: dto.amountFcfa,
    dateDepense: isoToFR(dto.expenseDate.slice(0, 10)),
    fournisseur: dto.supplierName ?? null,
    statut: STATUS_FROM_API[dto.status] ?? 'brouillon',
    creePar: dto.createdBy,
    valideParRole: dto.validatedBy ?? null,
    valideLe: isoDateTimeToFR(dto.validatedAt),
    motifRejet: dto.rejectionReason ?? null,
    piecesJointes: dto.attachmentUrls ?? [],
    historiqueValidation: (dto.validationHistory ?? []).map((s) => ({
      validatorId: s.validatorId,
      validatorRole: s.validatorRole,
      decision: DECISION_FROM_API[s.decision] ?? 'rejete',
      commentaire: s.comment ?? null,
      decideLe: isoDateTimeToFR(s.decidedAt) ?? '—',
    })),
    creeLe: isoDateTimeToFR(dto.createdAt) ?? '—',
  };
}

/**
 * Portage réel — création, consultation et pièces jointes (tâche #239),
 * voir le commentaire de `ExpensesPort`. La soumission, la décision et
 * l'annulation vivent côté `apps/comptable`.
 */
export function createExpensesApi(): ExpensesPort {
  return {
    async list(): Promise<Expense[]> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const page = await request<ApiPage<ExpenseResponseDto>>('/api/v1/accounting/expenses', {
        query: { schoolId, academicYearId, size: 200 },
      });
      return page.content.map(fromApiExpense);
    },

    /** Portage réel — voir le commentaire de `ExpensesPort.listPage`. */
    async listPage(input): Promise<{ items: Expense[]; totalElements: number; totalPages: number }> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const page = await request<ApiPage<ExpenseResponseDto>>('/api/v1/accounting/expenses', {
        query: { schoolId, academicYearId, page: input.page, size: input.size },
      });
      return { items: page.content.map(fromApiExpense), totalElements: page.totalElements, totalPages: page.totalPages };
    },

    async create(input): Promise<Expense> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const body: CreateExpenseRequestDto = {
        schoolId,
        academicYearId,
        category: CATEGORY_TO_API[input.categorie],
        label: input.libelle,
        amountFcfa: input.montantFcfa,
        expenseDate: frToISO(input.dateDepense),
        supplierName: input.fournisseur,
      };
      const dto = await request<ExpenseResponseDto>('/api/v1/accounting/expenses', { method: 'POST', body });
      return fromApiExpense(dto);
    },

    async attachFile(expenseId, file): Promise<Expense> {
      const formData = new FormData();
      formData.append('file', file);
      const dto = await request<ExpenseResponseDto>(`/api/v1/accounting/expenses/${encodeURIComponent(expenseId)}/attachments`, {
        method: 'POST',
        formData,
      });
      return fromApiExpense(dto);
    },
  };
}
