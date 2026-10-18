import { request, sessionContext } from '@/api/client';
import type { PayslipResponseDto } from '@/types/api';
import type { PayslipsPort } from '@/services/ports';
import type { PaymentChannel, SalaryMode, SalarySlip } from '@/types/domain';

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
    dateGeneration: dto.generatedAt.slice(0, 10).split('-').reverse().join('/'),
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
  };
}
