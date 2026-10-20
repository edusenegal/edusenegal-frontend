import { request, sessionContext } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import type { CashPaymentNoticeResponseDto, PayslipResponseDto } from '@/types/api';
import type { PayslipsPort } from '@/services/ports';
import type { CashPaymentNotice, PaymentChannel, SalaryMode, SalarySlip } from '@/types/domain';
import { buildDownloadFilename, downloadBlob, isoToFR } from '@/utils/format';

const MODE_FROM_API: Record<string, SalaryMode> = {
  FIXED: 'fixe',
  PER_WORKED_DAY: 'par_jour',
  PER_HOUR: 'par_heure',
};
const CHANNEL_FROM_API: Record<string, PaymentChannel> = {
  WAVE: 'wave',
  ORANGE_MONEY: 'orange_money',
  CASH: 'especes',
  CHEQUE: 'cheque',
  BANK_TRANSFER: 'virement_bancaire',
};

function fromCashNoticeResponse(dto: CashPaymentNoticeResponseDto): CashPaymentNotice {
  return {
    requestId: dto.requestId,
    periode: dto.periodLabel,
    montantFcfa: dto.amountFcfa,
    valideLe: dto.validatedAt ? isoToFR(dto.validatedAt.slice(0, 10)) : null,
  };
}

function fromPayslipResponse(dto: PayslipResponseDto): SalarySlip {
  return {
    id: dto.id,
    periode: dto.periodLabel,
    salaryMode: MODE_FROM_API[dto.salaryMode] ?? 'fixe',
    montantBrut: dto.grossAmountFcfa,
    joursTravailles: dto.workedDays,
    heuresTravaillees: dto.workedHours,
    joursAbsenceInjustifiee: dto.unjustifiedAbsenceDays,
    payeurEtat: dto.payerOwnership === 'PUBLIC',
    modePaiement: dto.paymentMethod ? CHANNEL_FROM_API[dto.paymentMethod] ?? null : null,
    dateGeneration: dto.generatedAt ? dto.generatedAt.slice(0, 10).split('-').reverse().join('/') : '—',
  };
}

/** Bulletins de salaire du professeur connecté — `payment-service`, lecture seule (voir la fiche "Ma fiche de paie" côté `edusenegal-web`). */
export function createPayslipsApi(): PayslipsPort {
  return {
    async mine(): Promise<SalarySlip[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<PayslipResponseDto[]>('/api/v1/accounting/salary-requests/payslips/me', {
        query: { schoolId },
      });
      return dtos.map(fromPayslipResponse);
    },

    async downloadPdf(payslipId): Promise<void> {
      const teacher = useAuthStore.getState().teacher;
      const blob = await request<Blob>(
        `/api/v1/accounting/salary-requests/payslips/${encodeURIComponent(payslipId)}/pdf`,
        { responseType: 'blob' },
      );
      downloadBlob(blob, buildDownloadFilename('fiche_de_paie', teacher?.prenom ?? '', teacher?.nom ?? ''));
    },

    async pendingCashNotices(): Promise<CashPaymentNotice[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<CashPaymentNoticeResponseDto[]>(
        '/api/v1/accounting/salary-requests/cash-notices/me',
        { query: { schoolId } },
      );
      return dtos.map(fromCashNoticeResponse);
    },

    async confirmCashReceipt(requestId): Promise<void> {
      const { userId } = sessionContext();
      await request<void>(
        `/api/v1/accounting/salary-requests/${encodeURIComponent(requestId)}/lines/${encodeURIComponent(userId)}/confirm-cash-receipt`,
        { method: 'POST' },
      );
    },

    async rejectCashReceipt(requestId, reason): Promise<void> {
      const { userId } = sessionContext();
      await request<void>(
        `/api/v1/accounting/salary-requests/${encodeURIComponent(requestId)}/lines/${encodeURIComponent(userId)}/reject-cash-receipt`,
        { method: 'POST', body: { reason } },
      );
    },
  };
}
