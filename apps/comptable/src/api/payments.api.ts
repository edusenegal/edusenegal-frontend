import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type {
  ApiPage,
  ClassPaymentStatsDto,
  StudentPaymentProgressResponseDto,
  ApiPaymentChannel,
  ApiPaymentType,
  PaymentTransactionResponseDto,
  RecordCashRequestDto,
  UserResponseDto,
} from '@/types/api';
import type { PaymentsPort } from '@/services/ports';
import type { IncomeRow, Paged, PaymentChannel, PaymentTransaction, PaymentType } from '@/types/domain';
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
const CHANNEL_TO_API: Record<PaymentChannel, ApiPaymentChannel> = {
  wave: 'WAVE',
  orange_money: 'ORANGE_MONEY',
  especes: 'CASH',
  cheque: 'CHEQUE',
  virement_bancaire: 'VIREMENT_BANCAIRE',
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
    },

    async getIncomes(filters): Promise<Paged<IncomeRow>> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      const [page, students] = await Promise.all([
        request<ApiPage<PaymentTransactionResponseDto & { studentId: string }>>('/api/v1/payments/incomes', {
          query: {
            schoolId,
            yearId,
            type: filters?.type ? TYPE_TO_API[filters.type] : undefined,
            channel: filters?.channel ? CHANNEL_TO_API[filters.channel] : undefined,
            from: filters?.from,
            to: filters?.to,
            page: filters?.page ?? 0,
            size: filters?.size ?? 20,
          },
        }),
        // Résolution des noms d'élèves (le backend ne renvoie que l'id).
        request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(schoolId)}`, {
          query: { role: 'STUDENT' },
        }).catch(() => [] as UserResponseDto[]),
      ]);
      const nameById = new Map(students.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
      return {
        content: page.content.map((dto) => ({
          ...fromApiTransaction(dto),
          studentId: dto.studentId,
          studentNom: nameById.get(dto.studentId) ?? dto.studentId,
        })),
        total: page.totalElements,
        totalPages: page.totalPages,
        page: page.number,
      };
    },

    async sendStudentAlert(studentId, classId) {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      await request<void>(
        `/api/v1/payments/overdue-alerts/${encodeURIComponent(schoolId)}/student/${encodeURIComponent(studentId)}`,
        { method: 'POST', query: { yearId, classId } },
      );
    },

    async getStudentProgress(studentId, classId) {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      const dto = await request<StudentPaymentProgressResponseDto>(
        `/api/v1/payments/student/${encodeURIComponent(studentId)}/progress`,
        { query: { schoolId, yearId, classId } },
      );
      return {
        studentId: dto.studentId,
        expectedGrossFcfa: dto.expectedGrossFcfa,
        scholarship: dto.scholarship,
        scholarshipPercentage: dto.scholarshipPercentage,
        scholarshipCoveredFcfa: dto.scholarshipCoveredFcfa,
        scholarshipPayerName: dto.scholarshipPayerName,
        expectedNetFcfa: dto.expectedNetFcfa,
        paidFcfa: dto.paidFcfa,
        remainingFcfa: dto.remainingFcfa,
        progressPercentage: dto.progressPercentage,
        status: dto.status,
      };
    },
  };
}
