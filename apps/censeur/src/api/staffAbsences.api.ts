import { request, sessionContext } from '@/api/client';
import type {
  RecordStaffAbsenceRequestDto,
  StaffAbsenceResponseDto,
  StaffAbsenceSummaryResponseDto,
} from '@/types/api';
import type { StaffAbsencesPort } from '@/services/ports';
import type { StaffAbsence, StaffAbsenceSummary } from '@/types/domain';
import { frToISO, isoToFR } from '@/utils/format';

function fromStaffAbsenceResponse(dto: StaffAbsenceResponseDto): StaffAbsence {
  return {
    id: dto.id,
    teacherId: dto.staffUserId,
    dateDebut: isoToFR(dto.dateFrom),
    dateFin: isoToFR(dto.dateTo),
    justifiee: dto.justified,
    motif: dto.reason,
    enregistreePar: dto.recordedBy,
  };
}

/** Portage réel — `attendance-service` (`StaffAbsenceController`). */
export function createStaffAbsencesApi(): StaffAbsencesPort {
  return {
    async list(teacherId): Promise<StaffAbsence[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<StaffAbsenceResponseDto[]>('/api/v1/staff-absences', {
        query: { schoolId, staffUserId: teacherId },
      });
      return dtos
        .map(fromStaffAbsenceResponse)
        .sort((a, b) => frToISO(b.dateDebut).localeCompare(frToISO(a.dateDebut)));
    },

    async record(teacherId, input): Promise<StaffAbsence> {
      const { schoolId } = sessionContext();
      const body: RecordStaffAbsenceRequestDto = {
        schoolId,
        staffUserId: teacherId,
        dateFrom: frToISO(input.dateDebut),
        dateTo: frToISO(input.dateFin),
        justified: input.justifiee,
        reason: input.motif ?? undefined,
      };
      const dto = await request<StaffAbsenceResponseDto>('/api/v1/staff-absences', { method: 'POST', body });
      return fromStaffAbsenceResponse(dto);
    },

    async remove(absenceId): Promise<void> {
      await request<void>(`/api/v1/staff-absences/${encodeURIComponent(absenceId)}`, { method: 'DELETE' });
    },

    async getSummary(teacherId, dateDebut, dateFin): Promise<StaffAbsenceSummary> {
      const { schoolId } = sessionContext();
      const dto = await request<StaffAbsenceSummaryResponseDto>('/api/v1/staff-absences/summary', {
        query: { schoolId, staffUserId: teacherId, from: frToISO(dateDebut), to: frToISO(dateFin) },
      });
      return { joursJustifies: dto.justifiedAbsenceDays, joursInjustifies: dto.unjustifiedAbsenceDays };
    },
  };
}
