import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type {
  ApiExpenseCategory,
  ApiExpenseStatus,
  ApiPage,
  ApiValidationDecision,
  ApiValidationStep,
  CreateExpenseRequestDto,
  ExpenseResponseDto,
  ValidateExpenseRequestDto,
} from '@/types/api';
import type { ExpensesPort } from '@/services/ports';
import type { Expense, ExpenseCategory, ExpenseDecision, ExpenseStatus, ExpenseValidationStep } from '@/types/domain';
import { isoToFR, frToISO, downloadBlob } from '@/utils/format';

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

const STATUS_FROM_API: Record<ApiExpenseStatus, ExpenseStatus> = {
  DRAFT: 'brouillon',
  PENDING_VALIDATION: 'en_attente',
  VALIDATED: 'validee',
  REJECTED: 'rejetee',
  CANCELLED: 'annulee',
};
const STATUS_TO_API: Record<ExpenseStatus, ApiExpenseStatus> = {
  brouillon: 'DRAFT',
  en_attente: 'PENDING_VALIDATION',
  validee: 'VALIDATED',
  rejetee: 'REJECTED',
  annulee: 'CANCELLED',
};

const DECISION_TO_API: Record<ExpenseDecision, ApiValidationDecision> = {
  approuve: 'APPROVED',
  rejete: 'REJECTED',
};
const DECISION_FROM_API: Record<ApiValidationDecision, ExpenseDecision> = {
  APPROVED: 'approuve',
  REJECTED: 'rejete',
};

/** "2026-11-05T10:30:00" → "05/11/2026 10:30". */
function isoDateTimeToFR(iso: string | null): string | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 16);
  return timePart ? `${isoToFR(datePart)} ${timePart}` : isoToFR(datePart);
}

function fromApiValidationStep(dto: ApiValidationStep): ExpenseValidationStep {
  return {
    validatorId: dto.validatorId,
    validatorRole: dto.validatorRole,
    decision: DECISION_FROM_API[dto.decision] ?? 'rejete',
    commentaire: dto.comment ?? null,
    decideLe: isoDateTimeToFR(dto.decidedAt) ?? '—',
  };
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
    soldeAvantFcfa: dto.balanceBeforeFcfa ?? null,
    soldeApresFcfa: dto.balanceAfterFcfa ?? null,
    piecesJointes: dto.attachmentUrls ?? [],
    historiqueValidation: (dto.validationHistory ?? []).map(fromApiValidationStep),
    creeLe: isoDateTimeToFR(dto.createdAt) ?? '—',
  };
}

export function createExpensesApi(): ExpensesPort {
  return {
    async list(filters) {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const page = await request<ApiPage<ExpenseResponseDto>>('/api/v1/accounting/expenses', {
        query: {
          schoolId,
          academicYearId,
          status: filters?.status ? STATUS_TO_API[filters.status] : undefined,
          category: filters?.category ? CATEGORY_TO_API[filters.category] : undefined,
          from: filters?.from,
          to: filters?.to,
          sort: filters?.sort === 'created' ? 'created' : 'date',
          page: filters?.page ?? 0,
          size: filters?.size ?? 20,
        },
      });
      return {
        content: page.content.map(fromApiExpense),
        total: page.totalElements,
        totalPages: page.totalPages,
        page: page.number,
      };
    },

    async findById(expenseId): Promise<Expense> {
      const dto = await request<ExpenseResponseDto>(`/api/v1/accounting/expenses/${encodeURIComponent(expenseId)}`);
      return fromApiExpense(dto);
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

    async submit(expenseId): Promise<Expense> {
      const dto = await request<ExpenseResponseDto>(
        `/api/v1/accounting/expenses/${encodeURIComponent(expenseId)}/submit`,
        { method: 'POST' },
      );
      return fromApiExpense(dto);
    },

    async validate(expenseId, decision, commentaire): Promise<Expense> {
      const body: ValidateExpenseRequestDto = { decision: DECISION_TO_API[decision], comment: commentaire };
      const dto = await request<ExpenseResponseDto>(
        `/api/v1/accounting/expenses/${encodeURIComponent(expenseId)}/validate`,
        { method: 'POST', body },
      );
      return fromApiExpense(dto);
    },

    async cancel(expenseId): Promise<Expense> {
      const dto = await request<ExpenseResponseDto>(
        `/api/v1/accounting/expenses/${encodeURIComponent(expenseId)}/cancel`,
        { method: 'POST' },
      );
      return fromApiExpense(dto);
    },

    async attachFile(expenseId, file): Promise<Expense> {
      const formData = new FormData();
      formData.append('file', file);
      const dto = await request<ExpenseResponseDto>(
        `/api/v1/accounting/expenses/${encodeURIComponent(expenseId)}/attachments`,
        { method: 'POST', formData },
      );
      return fromApiExpense(dto);
    },

    // CORRECTION (demande explicite) : « Justificatifs » n'offrait qu'un
    // <a href={urlPresignee}>, parfois indisponible ou mal résolu depuis le
    // navigateur (même défaut déjà corrigé côté signatures). Octets récupérés
    // directement via l'endpoint authentifié, jamais l'URL présignée.
    async downloadAttachment(expenseId, index, suggestedFilename): Promise<void> {
      const blob = await request<Blob>(
        `/api/v1/accounting/expenses/${encodeURIComponent(expenseId)}/attachments/${index}/download`,
        { responseType: 'blob' },
      );
      downloadBlob(blob, suggestedFilename);
    },
  };
}
