import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type {
  ApiWalletTransactionType,
  CreditWalletRequestDto,
  DebitWalletRequestDto,
  WalletResponseDto,
  WalletTransactionResponseDto,
} from '@/types/api';
import type { WalletPort } from '@/services/ports';
import type { StudentWallet, WalletCreditType, WalletTransaction, WalletTransactionType } from '@/types/domain';
import { isoToFR } from '@/utils/format';

const CREDIT_TYPE_TO_API: Record<WalletCreditType, ApiWalletTransactionType> = {
  bourse: 'SCHOLARSHIP_DISBURSEMENT',
  credit_manuel: 'MANUAL_CREDIT',
  remboursement: 'REFUND',
};

const TYPE_FROM_API: Record<ApiWalletTransactionType, WalletTransactionType> = {
  SCHOLARSHIP_DISBURSEMENT: 'bourse',
  RESTO_TICKET_PURCHASE: 'achat_ticket',
  MANUAL_CREDIT: 'credit_manuel',
  MANUAL_DEBIT: 'debit_manuel',
  REFUND: 'remboursement',
};

/** "2026-11-05T10:30:00" → "05/11/2026 10:30". */
function isoDateTimeToFR(iso: string | null): string | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 16);
  return timePart ? `${isoToFR(datePart)} ${timePart}` : isoToFR(datePart);
}

function fromApiWallet(dto: WalletResponseDto): StudentWallet {
  return {
    studentId: dto.studentId,
    soldeFcfa: dto.balanceFcfa,
    totalCrediteFcfa: dto.totalCreditedFcfa,
    totalDebiteFcfa: dto.totalDebitedFcfa,
    derniereMajLe: isoDateTimeToFR(dto.updatedAt),
  };
}

function fromApiTransaction(dto: WalletTransactionResponseDto): WalletTransaction {
  return {
    id: dto.id,
    type: TYPE_FROM_API[dto.type] ?? 'credit_manuel',
    credit: dto.credit,
    montantFcfa: dto.amountFcfa,
    soldeApresFcfa: dto.balanceAfterFcfa,
    note: dto.note,
    date: isoDateTimeToFR(dto.createdAt) ?? '—',
  };
}

export function createWalletApi(): WalletPort {
  return {
    async get(studentId): Promise<StudentWallet> {
      const academicYearId = await resolveYearId();
      const dto = await request<WalletResponseDto>(
        `/api/v1/payments/wallet/student/${encodeURIComponent(studentId)}`,
        { query: { academicYearId } },
      );
      return fromApiWallet(dto);
    },

    async getHistory(studentId): Promise<WalletTransaction[]> {
      const academicYearId = await resolveYearId();
      const list = await request<WalletTransactionResponseDto[]>(
        `/api/v1/payments/wallet/student/${encodeURIComponent(studentId)}/transactions`,
        { query: { academicYearId } },
      );
      return list.map(fromApiTransaction);
    },

    async credit(studentId, input): Promise<StudentWallet> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const body: CreditWalletRequestDto = {
        schoolId,
        academicYearId,
        amountFcfa: input.amountFcfa,
        type: CREDIT_TYPE_TO_API[input.type],
        note: input.note,
        idempotencyKey: crypto.randomUUID(),
      };
      const dto = await request<WalletResponseDto>(
        `/api/v1/payments/wallet/student/${encodeURIComponent(studentId)}/credits`,
        { method: 'POST', body },
      );
      return fromApiWallet(dto);
    },

    async debit(studentId, input): Promise<StudentWallet> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const body: DebitWalletRequestDto = {
        schoolId,
        academicYearId,
        amountFcfa: input.amountFcfa,
        note: input.note,
        idempotencyKey: crypto.randomUUID(),
      };
      const dto = await request<WalletResponseDto>(
        `/api/v1/payments/wallet/student/${encodeURIComponent(studentId)}/debits`,
        { method: 'POST', body },
      );
      return fromApiWallet(dto);
    },
  };
}
