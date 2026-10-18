import { request, sessionContext } from '@/api/client';
import type { ApiComplaintType, ComplaintResponseDto, CreateComplaintRequestDto } from '@/types/api';
import type { ComplaintsPort } from '@/services/ports';
import type { Complaint, ComplaintStatus, ComplaintType } from '@/types/domain';
import { isoToFR } from '@/utils/format';

const TYPE_TO_API: Record<ComplaintType, ApiComplaintType> = {
  contre_professeur: 'TEACHER_COMPLAINT',
  contestation_note: 'GRADE_COMPLAINT',
  emploi_du_temps: 'SCHEDULE_COMPLAINT',
  infrastructure: 'FACILITY_COMPLAINT',
  administratif: 'ADMINISTRATIVE_COMPLAINT',
  suggestion: 'SUGGESTION',
  autre: 'OTHER',
};
const TYPE_FROM_API: Record<ApiComplaintType, ComplaintType> = Object.fromEntries(
  Object.entries(TYPE_TO_API).map(([k, v]) => [v, k]),
) as Record<ApiComplaintType, ComplaintType>;
const STATUS_FROM_API: Record<string, ComplaintStatus> = {
  SUBMITTED: 'soumise',
  UNDER_REVIEW: 'en_cours',
  RESOLVED: 'resolue',
  REJECTED: 'rejetee',
  ARCHIVED: 'archivee',
};

function fromComplaintResponse(dto: ComplaintResponseDto): Complaint {
  return {
    id: dto.id,
    type: TYPE_FROM_API[dto.type] ?? 'autre',
    sujet: dto.subject,
    description: dto.description,
    statut: STATUS_FROM_API[dto.status] ?? 'soumise',
    resolution: dto.resolution,
    creeLe: isoToFR(dto.createdAt.slice(0, 10)),
  };
}

/** Réclamations/suggestions du professeur connecté — `complaint-service`, `/api/v1/complaints`. */
export function createComplaintsApi(): ComplaintsPort {
  return {
    async mine(): Promise<Complaint[]> {
      const dtos = await request<ComplaintResponseDto[]>('/api/v1/complaints/my');
      return dtos.map(fromComplaintResponse);
    },

    async create(input): Promise<Complaint> {
      const { schoolId } = sessionContext();
      const body: CreateComplaintRequestDto = {
        schoolId,
        type: TYPE_TO_API[input.type],
        subject: input.sujet,
        description: input.description,
        isAnonymous: input.anonyme ?? false,
        isConfidential: false,
      };
      const dto = await request<ComplaintResponseDto>('/api/v1/complaints', { method: 'POST', body });
      return fromComplaintResponse(dto);
    },
  };
}
