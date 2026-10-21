import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type {
  ApiPage,
  ApiPaymentChannel,
  ApiSalaryMode,
  CreateSalaryPaymentRequestDto,
  SalaryLineResponseDto,
  SalaryPaymentRequestResponseDto,
} from '@/types/api';
import type { SalaryRequestsPort } from '@/services/ports';
import type { PaymentChannel, PayoutStatus, SalaryMode, SalaryRequest, SalaryRequestLine, SalaryRequestStatus } from '@/types/domain';
import { frToISO, isoToFR } from '@/utils/format';

const SALARY_MODE_FROM_API: Record<ApiSalaryMode, SalaryMode> = {
  FIXED: 'fixe',
  PER_WORKED_DAY: 'par_jour',
  PER_HOUR: 'par_heure',
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

const STATUS_FROM_API: Record<string, SalaryRequestStatus> = {
  DRAFT: 'brouillon',
  PENDING_VALIDATION: 'en_attente',
  VALIDATED: 'validee',
  REJECTED: 'rejetee',
  CANCELLED: 'annulee',
};

/**
 * `DISPUTED` (le professeur a contesté avoir reçu un paiement en espèces,
 * voir `PayoutStatus` côté payment-service) n'a pas d'équivalent dans le
 * `PayoutStatus` de cette application (lecture seule côté direction, sans
 * le détail de contestation que montre `apps/comptable`) — repli sur
 * `echec`, qui reste le signal le plus proche ("ce versement a besoin
 * d'attention").
 */
const PAYOUT_FROM_API: Record<string, PayoutStatus> = {
  PENDING: 'en_attente',
  PAID: 'paye',
  FAILED: 'echec',
  AWAITING_CASH_CONFIRMATION: 'attente_confirmation_cash',
  DISPUTED: 'echec',
};

function fromApiSalaryLine(dto: SalaryLineResponseDto): SalaryRequestLine {
  return {
    teacherId: dto.staffUserId,
    teacherNom: dto.staffFullName,
    salaryMode: SALARY_MODE_FROM_API[dto.salaryMode] ?? 'fixe',
    joursTravailles: dto.workedDays,
    heuresTravaillees: dto.workedHours,
    joursAbsenceInjustifiee: dto.unjustifiedAbsenceDays,
    montantCalcule: dto.computedAmountFcfa ?? 0,
    payeurEtat: dto.payerOwnership === 'PUBLIC',
    payslipId: dto.payslipId,
    modePaiement: CHANNEL_FROM_API[dto.paymentMethod] ?? 'especes',
    destinationPaiement: dto.payoutDestination,
    statutVersement: PAYOUT_FROM_API[dto.payoutStatus] ?? null,
    referenceTransaction: dto.payoutTransactionRef,
    motifEchecPaiement: dto.payoutFailureReason,
  };
}

function fromApiSalaryRequest(dto: SalaryPaymentRequestResponseDto): SalaryRequest {
  return {
    id: dto.id,
    periode: dto.periodLabel,
    dateDebut: isoToFR(dto.periodStart),
    dateFin: isoToFR(dto.periodEnd),
    lignes: dto.lines.map(fromApiSalaryLine),
    montantTotal: dto.totalAmountFcfa,
    statut: STATUS_FROM_API[dto.status] ?? 'brouillon',
    dateCreation: dto.createdAt ? isoToFR(dto.createdAt.slice(0, 10)) : '—',
    motifRejet: dto.rejectionReason,
  };
}

/**
 * Portage de l'écran "Demandes de paiement de salaire" (direction) sur le
 * backend réel — restait sur `createMockServices()` (voir `src/api/index.ts`)
 * alors que le port documente déjà les endpoints réels : une demande créée
 * ici n'atteignait donc jamais `payment-service`, et un règlement choisi en
 * Wave/Orange Money ne pouvait qu'apparaître en espèces côté comptable (seul
 * mode que le mock connaissait), puisque la demande elle-même n'existait
 * jamais réellement. Le même backend et le même mapping de canaux que
 * `apps/comptable/src/api/salaryPayments.api.ts`, limité à ce que ce port
 * expose (`list`/`create`/`submit`/`cancel` — la validation/le règlement
 * restent une action du comptable, hors de cette application).
 */
export function createSalaryRequestsApi(): SalaryRequestsPort {
  return {
    async list(): Promise<SalaryRequest[]> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const page = await request<ApiPage<SalaryPaymentRequestResponseDto>>('/api/v1/accounting/salary-requests', {
        query: { schoolId, academicYearId, size: 200 },
      });
      return page.content.map(fromApiSalaryRequest);
    },

    async create(input): Promise<SalaryRequest> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const body: CreateSalaryPaymentRequestDto = {
        schoolId,
        academicYearId,
        periodLabel: input.periode,
        periodStart: frToISO(input.dateDebut),
        periodEnd: frToISO(input.dateFin),
        lines: input.lignes.map((l) => ({
          staffUserId: l.teacherId,
          workedDays: l.joursTravailles,
          workedHours: l.heuresTravaillees,
          paymentMethod: l.modePaiement ? CHANNEL_TO_API[l.modePaiement] : undefined,
          payoutDestination: l.destinationPaiement,
        })),
      };
      const dto = await request<SalaryPaymentRequestResponseDto>('/api/v1/accounting/salary-requests', {
        method: 'POST',
        body,
      });
      return fromApiSalaryRequest(dto);
    },

    async submit(requestId): Promise<SalaryRequest> {
      const dto = await request<SalaryPaymentRequestResponseDto>(
        `/api/v1/accounting/salary-requests/${encodeURIComponent(requestId)}/submit`,
        { method: 'POST' },
      );
      return fromApiSalaryRequest(dto);
    },

    async cancel(requestId): Promise<SalaryRequest> {
      const dto = await request<SalaryPaymentRequestResponseDto>(
        `/api/v1/accounting/salary-requests/${encodeURIComponent(requestId)}/cancel`,
        { method: 'POST' },
      );
      return fromApiSalaryRequest(dto);
    },
  };
}
