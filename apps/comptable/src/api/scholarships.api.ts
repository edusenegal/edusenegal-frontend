import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import { AppError } from '@/services/errors';
import type {
  ApiPaymentChannel,
  ApiScholarshipPaymentStatus,
  ApiScholarshipStatus,
  ScholarshipPaymentSliceDto,
  ScholarshipResponseDto,
} from '@/types/api';
import type { ScholarshipsPort } from '@/services/ports';
import type { PaymentChannel, Scholarship, ScholarshipSlice, ScholarshipSliceStatus, ScholarshipStatus } from '@/types/domain';
import { frToISO, isoToFR } from '@/utils/format';

const CHANNEL_TO_API: Record<PaymentChannel, ApiPaymentChannel> = {
  wave: 'WAVE',
  orange_money: 'ORANGE_MONEY',
  especes: 'CASH',
  cheque: 'CHEQUE',
  virement_bancaire: 'VIREMENT_BANCAIRE',
};

const STATUS_FROM_API: Record<ApiScholarshipStatus, ScholarshipStatus> = {
  PENDING_VALIDATION: 'en_attente_validation',
  VALIDATED: 'validee',
  REJECTED: 'rejetee',
  ACTIVE: 'active',
  SUSPENDED: 'suspendue',
  COMPLETED: 'terminee',
};

const SLICE_STATUS_FROM_API: Record<ApiScholarshipPaymentStatus, ScholarshipSliceStatus> = {
  EXPECTED: 'attendue',
  PAID: 'payee',
  LATE: 'en_retard',
  PARTIAL: 'partielle',
  PENDING: 'en_cours',
};

function fromApiSlice(dto: ScholarshipPaymentSliceDto): ScholarshipSlice {
  return {
    id: dto.id,
    montantAttenduFcfa: dto.expectedFcfa,
    dateEcheance: isoToFR(dto.dueDate),
    montantPayeFcfa: dto.paidFcfa,
    dernierVersementLe: dto.lastPaidDate ? isoToFR(dto.lastPaidDate) : null,
    statut: SLICE_STATUS_FROM_API[dto.status] ?? 'attendue',
    justificatifUrl: dto.paymentProofUrl,
    note: dto.note,
  };
}

function fromApiScholarship(dto: ScholarshipResponseDto): Scholarship {
  return {
    id: dto.id,
    studentId: dto.studentId,
    payeurNom: dto.payerName,
    payeurType: dto.payerType,
    payeurContact: dto.payerContact,
    payeurReference: dto.payerReference,
    pourcentageCouvert: dto.percentageCovered,
    montantAnnuelTotalFcfa: dto.totalAnnualFcfa,
    montantCouvertFcfa: dto.amountCoveredFcfa,
    resteEleveFcfa: dto.studentRemainingFcfa,
    statut: STATUS_FROM_API[dto.status] ?? 'en_attente_validation',
    motifRejet: dto.rejectionReason,
    tranches: (dto.paymentSlices ?? []).map(fromApiSlice),
    totalPayeParPayeurFcfa: dto.totalPaidByPayerFcfa,
    resteAPayerParPayeurFcfa: dto.remainingToPayByPayerFcfa,
    progressionPayeurPercent: dto.payerProgressPercent,
    dateCreation: isoToFR(dto.createdAt.slice(0, 10)),
  };
}

export function createScholarshipsApi(): ScholarshipsPort {
  return {
    async findByStudent(studentId): Promise<Scholarship | null> {
      const yearId = await resolveYearId();
      try {
        const dto = await request<ScholarshipResponseDto>(`/api/v1/scholarships/student/${encodeURIComponent(studentId)}`, {
          query: { yearId },
        });
        return fromApiScholarship(dto);
      } catch (error) {
        // 404 : pas de dossier de bourse pour cet élève cette année — état
        // normal pour la grande majorité des élèves, pas une anomalie.
        if (error instanceof AppError && error.kind === 'notFound') {
          return null;
        }
        throw error;
      }
    },

    async listBySchool(): Promise<Scholarship[]> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      const list = await request<ScholarshipResponseDto[]>(`/api/v1/scholarships/school/${encodeURIComponent(schoolId)}`, {
        query: { yearId },
      });
      return list.map(fromApiScholarship);
    },

    async listByPayer(payerName): Promise<Scholarship[]> {
      const yearId = await resolveYearId();
      const list = await request<ScholarshipResponseDto[]>('/api/v1/scholarships/by-payer', {
        query: { payerName, yearId },
      });
      return list.map(fromApiScholarship);
    },

    async recordSlicePayment(scholarshipId, input): Promise<Scholarship> {
      const formData = new FormData();
      formData.append('sliceId', input.sliceId);
      formData.append('paidFcfa', String(input.paidFcfa));
      formData.append('paidDate', frToISO(input.paidDate));
      formData.append('channel', CHANNEL_TO_API[input.channel]);
      if (input.note) formData.append('note', input.note);
      if (input.paymentProof) formData.append('paymentProof', input.paymentProof);

      const dto = await request<ScholarshipResponseDto>(
        `/api/v1/scholarships/${encodeURIComponent(scholarshipId)}/slices`,
        { method: 'POST', formData },
      );
      return fromApiScholarship(dto);
    },
  };
}
