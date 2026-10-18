import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type { LeaveRequestResponseDto } from '@/types/api';
import type { LeavesPort } from '@/services/ports';
import type { LeaveRequest, LeaveStatus } from '@/types/domain';
import { isoToFR } from '@/utils/format';

const STATUS_FROM_API: Record<string, LeaveStatus> = {
  PENDING: 'en_attente',
  APPROVED: 'approuve',
  REJECTED: 'rejete',
};

function fromLeaveResponse(dto: LeaveRequestResponseDto): LeaveRequest {
  return {
    id: dto.id,
    dateDebut: isoToFR(dto.startDate),
    dateFin: isoToFR(dto.endDate),
    motif: dto.reason,
    statut: STATUS_FROM_API[dto.status] ?? 'en_attente',
    remplacant: dto.replacementTeacherId,
    motifRefus: dto.status === 'REJECTED' ? dto.reviewNote : null,
  };
}

/** Congés du professeur connecté — `schedule-service`, `/api/v1/leaves`. */
export function createLeavesApi(): LeavesPort {
  return {
    async mine(): Promise<LeaveRequest[]> {
      const { userId } = sessionContext();
      const dtos = await request<LeaveRequestResponseDto[]>(`/api/v1/leaves/teacher/${encodeURIComponent(userId)}`);
      return dtos.map(fromLeaveResponse);
    },

    async request(input): Promise<LeaveRequest> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const formData = new FormData();
      formData.append('schoolId', schoolId);
      formData.append('academicYearId', academicYearId);
      formData.append('startDate', input.dateDebut);
      formData.append('endDate', input.dateFin);
      formData.append('reason', input.motif);
      if (input.remplacantId) {
        formData.append('replacementTeacherId', input.remplacantId);
      }
      if (input.pieceJointe) {
        formData.append('documents', input.pieceJointe);
      }
      const dto = await request<LeaveRequestResponseDto>('/api/v1/leaves', { method: 'POST', formData });
      return fromLeaveResponse(dto);
    },
  };
}
