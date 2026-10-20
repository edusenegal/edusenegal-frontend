import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type {
  ApiPage,
  ApiPaymentChannel,
  ApiSalaryMode,
  ApiValidationDecision,
  ApiValidationStep,
  CreateSalaryPaymentRequestDto,
  PayslipResponseDto,
  SalaryLineResponseDto,
  SalaryPaymentRequestResponseDto,
  SchoolSalaryProfileResponseDto,
  UserResponseDto,
  ValidateSalaryPaymentRequestDto,
} from '@/types/api';
import type { SalaryPaymentsPort } from '@/services/ports';
import type {
  ExpenseDecision,
  PaymentChannel,
  PayoutStatus,
  PayrollStaffMember,
  SalaryMode,
  SalaryRequest,
  SalaryRequestLine,
  SalaryRequestStatus,
  SalarySlip,
  SalaryValidationStep,
} from '@/types/domain';
import { buildDownloadFilename, downloadBlob, frToISO, isoToFR } from '@/utils/format';

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
const STATUS_TO_API: Record<SalaryRequestStatus, string> = {
  brouillon: 'DRAFT',
  en_attente: 'PENDING_VALIDATION',
  validee: 'VALIDATED',
  rejetee: 'REJECTED',
  annulee: 'CANCELLED',
};

const PAYOUT_FROM_API: Record<string, PayoutStatus> = {
  PENDING: 'en_attente',
  PAID: 'paye',
  FAILED: 'echec',
  AWAITING_CASH_CONFIRMATION: 'attente_confirmation_cash',
  // Le professeur a contesté avoir reçu ce paiement en espèces — voir
  // PayoutStatus.DISPUTED (payment-service) ; motifEchecPaiement (même
  // champ que l'échec Wave/Orange Money) porte alors son motif.
  DISPUTED: 'conteste',
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

function fromApiValidationStep(dto: ApiValidationStep): SalaryValidationStep {
  return {
    validatorId: dto.validatorId,
    validatorRole: dto.validatorRole,
    decision: DECISION_FROM_API[dto.decision] ?? 'rejete',
    commentaire: dto.comment ?? null,
    decideLe: isoDateTimeToFR(dto.decidedAt) ?? '—',
  };
}

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
    dateCreation: isoDateTimeToFR(dto.createdAt) ?? '—',
    motifRejet: dto.rejectionReason,
    historiqueValidation: (dto.validationHistory ?? []).map(fromApiValidationStep),
    splitFromRequestId: dto.splitFromRequestId,
    splitIntoRequestId: dto.splitIntoRequestId,
  };
}

function fromApiPayslip(dto: PayslipResponseDto): SalarySlip {
  return {
    id: dto.id,
    teacherId: dto.staffUserId,
    teacherNom: dto.staffFullName,
    periode: dto.periodLabel,
    salaryMode: SALARY_MODE_FROM_API[dto.salaryMode] ?? 'fixe',
    montantBrut: dto.grossAmountFcfa,
    joursTravailles: dto.workedDays,
    heuresTravaillees: dto.workedHours,
    joursAbsenceInjustifiee: dto.unjustifiedAbsenceDays,
    payeurEtat: dto.payerOwnership === 'PUBLIC',
    dateGeneration: isoToFR(dto.generatedAt.slice(0, 10)),
  };
}

async function fetchStaffByRole(schoolId: string, role: 'TEACHER' | 'INSTITUTEUR'): Promise<UserResponseDto[]> {
  return request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(schoolId)}`, { query: { role } });
}

/**
 * Absente tant qu'aucun salaire n'a jamais été configuré pour ce couple
 * personnel/école (`salaryMode` vaut alors `null` dans la réponse, pas une
 * 404) — `undefined` en repli uniquement si l'appel échoue réellement, pour
 * ne jamais faire échouer tout le picker pour un seul profil introuvable.
 */
async function fetchSalaryProfile(userId: string, schoolId: string): Promise<SchoolSalaryProfileResponseDto | undefined> {
  try {
    return await request<SchoolSalaryProfileResponseDto>(
      `/api/v1/users/${encodeURIComponent(userId)}/schools/${encodeURIComponent(schoolId)}/salary`,
    );
  } catch {
    return undefined;
  }
}

export function createSalaryPaymentsApi(): SalaryPaymentsPort {
  return {
    async list(filters): Promise<SalaryRequest[]> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const page = await request<ApiPage<SalaryPaymentRequestResponseDto>>('/api/v1/accounting/salary-requests', {
        query: {
          schoolId,
          academicYearId,
          status: filters?.status ? STATUS_TO_API[filters.status] : undefined,
          size: 200,
        },
      });
      return page.content.map(fromApiSalaryRequest);
    },

    async findById(requestId): Promise<SalaryRequest> {
      const dto = await request<SalaryPaymentRequestResponseDto>(
        `/api/v1/accounting/salary-requests/${encodeURIComponent(requestId)}`,
      );
      return fromApiSalaryRequest(dto);
    },

    async listPayableStaff(): Promise<PayrollStaffMember[]> {
      const { schoolId } = sessionContext();
      const [teachers, instituteurs] = await Promise.all([
        fetchStaffByRole(schoolId, 'TEACHER'),
        fetchStaffByRole(schoolId, 'INSTITUTEUR'),
      ]);
      const staff = [...teachers, ...instituteurs];
      const profiles = await Promise.all(staff.map((u) => fetchSalaryProfile(u.id, schoolId)));
      return staff.map((u, i) => {
        const profile = profiles[i];
        return {
          id: u.id,
          nom: `${u.firstName} ${u.lastName}`,
          tel: u.phone ?? null,
          salaryMode: profile?.salaryMode ? SALARY_MODE_FROM_API[profile.salaryMode] : null,
          salaireFixe: profile?.fixedAmountFcfa ?? null,
          tauxJournalier: profile?.dailyRateFcfa ?? null,
          tauxHoraire: profile?.hourlyRateFcfa ?? null,
        };
      });
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
          staffUserId: l.staffUserId,
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

    async validate(requestId, decision, options): Promise<SalaryRequest> {
      const body: ValidateSalaryPaymentRequestDto = {
        decision: DECISION_TO_API[decision],
        comment: options?.comment,
        selectedStaffUserIds: options?.selectedStaffUserIds,
      };
      const dto = await request<SalaryPaymentRequestResponseDto>(
        `/api/v1/accounting/salary-requests/${encodeURIComponent(requestId)}/validate`,
        { method: 'POST', body },
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

    async listPayslips(staffUserId): Promise<SalarySlip[]> {
      const { schoolId } = sessionContext();
      const list = await request<PayslipResponseDto[]>('/api/v1/accounting/salary-requests/payslips', {
        query: { schoolId, staffUserId },
      });
      return list.map(fromApiPayslip);
    },

    // CORRECTION (demande explicite) : la vue "Bulletins de paie" n'offrait
    // aucun moyen de voir/télécharger le PDF -- le même endpoint que celui
    // déjà utilisé par `apps/teacher` (PayslipsPage), jamais un lien direct.
    async downloadPayslipPdf(payslip): Promise<void> {
      const blob = await request<Blob>(
        `/api/v1/accounting/salary-requests/payslips/${encodeURIComponent(payslip.id)}/pdf`,
        { responseType: 'blob' },
      );
      const [firstName, ...rest] = payslip.teacherNom.trim().split(/\s+/);
      downloadBlob(blob, buildDownloadFilename('fiche_de_paie', firstName ?? '', rest.join(' ')));
    },
  };
}
