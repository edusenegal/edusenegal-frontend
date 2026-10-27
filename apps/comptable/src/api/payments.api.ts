import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type {
  ClassPaymentStatsDto,
  ApiPaymentChannel,
  ApiPaymentType,
  PaymentTransactionResponseDto,
  RecordCashRequestDto,
} from '@/types/api';
import type { PaymentsPort } from '@/services/ports';
import type { PaymentChannel, PaymentTransaction, PaymentType } from '@/types/domain';
import { frToISO, isoToFR } from '@/utils/format';

const TYPE_FROM_API: Record<ApiPaymentType, PaymentType> = {
  INSCRIPTION_ONLY: 'inscription_seule',
  MONTHLY: 'mensuel',
  QUARTERLY: 'trimestriel',
  ANNUAL: 'annuel',
  INSCRIPTION_MONTHLY: 'inscription_mensuel',
  INSCRIPTION_QUARTERLY: 'inscription_trimestriel',
  INSCRIPTION_ANNUAL: 'inscription_annuel',
  SCHOLARSHIP: 'bourse',
};
const TYPE_TO_API: Record<PaymentType, ApiPaymentType> = {
  inscription_seule: 'INSCRIPTION_ONLY',
  mensuel: 'MONTHLY',
  trimestriel: 'QUARTERLY',
  annuel: 'ANNUAL',
  inscription_mensuel: 'INSCRIPTION_MONTHLY',
  inscription_trimestriel: 'INSCRIPTION_QUARTERLY',
  inscription_annuel: 'INSCRIPTION_ANNUAL',
  bourse: 'SCHOLARSHIP',
};

const CHANNEL_FROM_API: Record<ApiPaymentChannel, PaymentChannel> = {
  WAVE: 'wave',
  ORANGE_MONEY: 'orange_money',
  CASH: 'especes',
  CHEQUE: 'cheque',
  VIREMENT_BANCAIRE: 'virement_bancaire',
};

/** "2026-11-05T10:30:00" → "05/11/2026 10:30". */
function isoDateTimeToFR(iso: string | null): string | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 16);
  return timePart ? `${isoToFR(datePart)} ${timePart}` : isoToFR(datePart);
}

export function fromApiTransaction(dto: PaymentTransactionResponseDto): PaymentTransaction {
  return {
    id: dto.id,
    type: TYPE_FROM_API[dto.type] ?? 'mensuel',
    statut:
      dto.status === 'COMPLETED'
        ? 'complete'
        : dto.status === 'FAILED'
          ? 'echoue'
          : dto.status === 'REFUNDED'
            ? 'rembourse'
            : dto.status === 'OVERDUE'
              ? 'en_retard'
              : 'en_attente',
    montantFcfa: dto.amountFcfa,
    remiseFcfa: dto.discountFcfa,
    montantNetFcfa: dto.netAmountFcfa,
    canal: CHANNEL_FROM_API[dto.channel] ?? 'especes',
    period: dto.period,
    echeanceNumero: dto.installmentNumber,
    echeancesTotal: dto.totalInstallments,
    dateEcheance: dto.dueDate ? isoToFR(dto.dueDate) : null,
    datePaiement: dto.paidDate ? isoToFR(dto.paidDate) : null,
    receiptUrl: dto.receiptUrl,
    scholarshipId: dto.scholarshipId,
    soldeAvantFcfa: dto.balanceBeforeFcfa ?? null,
    soldeApresFcfa: dto.balanceAfterFcfa ?? null,
    dateCreation: isoDateTimeToFR(dto.createdAt) ?? '—',
  };
}

export function createPaymentsApi(): PaymentsPort {
  return {
    async getHistory(studentId): Promise<PaymentTransaction[]> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const list = await request<PaymentTransactionResponseDto[]>(`/api/v1/payments/student/${encodeURIComponent(studentId)}`, {
        query: { schoolId, yearId: academicYearId },
      });
      return list.map(fromApiTransaction);
    },

    async recordCash(input): Promise<PaymentTransaction> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const body: RecordCashRequestDto = {
        schoolId,
        studentId: input.studentId,
        academicYearId,
        type: TYPE_TO_API[input.type],
        amountFcfa: input.amountFcfa,
        period: input.period,
        installmentNumber: input.installmentNumber,
        totalInstallments: input.totalInstallments,
        dueDate: input.dueDate ? frToISO(input.dueDate) : undefined,
        note: input.note,
      };
      const dto = await request<PaymentTransactionResponseDto>('/api/v1/payments/cash', { method: 'POST', body });
      return fromApiTransaction(dto);
    },

    async getReceiptUrl(transactionId): Promise<string> {
      return request<string>(`/api/v1/payments/${encodeURIComponent(transactionId)}/receipt`);
    },

    async getCollection(studentIds) {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      if (studentIds.length === 0) {
        return { totalStudents: 0, totalExpectedFcfa: 0, totalCollectedFcfa: 0, totalRemainingFcfa: 0, collectionRate: 0, byStudent: [] };
      }
      const dto = await request<ClassPaymentStatsDto>('/api/v1/payments/stats/by-students', {
        query: { schoolId, yearId, studentIds: studentIds.join(',') },
      });
      return {
        totalStudents: dto.totalStudents,
        totalExpectedFcfa: dto.totalExpectedFcfa,
        totalCollectedFcfa: dto.totalCollectedFcfa,
        totalRemainingFcfa: dto.totalRemainingFcfa,
        collectionRate: dto.collectionRate,
        byStudent: dto.byStudent.map((r) => ({
          studentId: r.studentId,
          expectedFcfa: r.expectedFcfa,
          collectedFcfa: r.collectedFcfa,
          collectionRate: r.collectionRate,
          status: r.status,
        })),
      };
    },  };
}
