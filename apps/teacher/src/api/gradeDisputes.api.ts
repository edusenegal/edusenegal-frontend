import { request } from '@/api/client';
import { TYPE_FROM_API } from '@/api/grades.api';
import type { GradeDisputeResponseDto, TeacherDisputeDecisionRequestDto } from '@/types/api';
import type { GradeDisputesPort } from '@/services/ports';
import type { GradeDispute, GradeDisputeStatus } from '@/types/domain';
import { isoToFR } from '@/utils/format';

const STATUS_FROM_API: Record<string, GradeDisputeStatus> = {
  PENDING_TEACHER: 'en_attente_professeur',
  PENDING_SUPERVISOR: 'en_attente_surveillant',
  PENDING_DIRECTOR: 'en_attente_directeur',
  PENDING_TEACHER_DIRECTED: 'en_attente_professeur_dirigee',
  RESOLVED_APPROVED: 'resolue_approuvee',
  RESOLVED_REJECTED: 'resolue_rejetee',
};

function fromDisputeResponse(dto: GradeDisputeResponseDto): GradeDispute {
  return {
    id: dto.id,
    studentId: dto.studentId,
    classId: dto.classId,
    subjectId: dto.subjectId,
    subjectNom: dto.subjectName,
    type: dto.type ? TYPE_FROM_API[dto.type] ?? null : null,
    valeurContestee: dto.disputedValue,
    valeurActuelle: dto.currentValue,
    motif: dto.reason,
    statut: STATUS_FROM_API[dto.status] ?? 'en_attente_professeur',
    creeLe: isoToFR(dto.createdAt.slice(0, 10)),
  };
}

/**
 * Décision du professeur concerné (niveau 1) sur une réclamation de note —
 * `academic-service`, `/api/v1/academic/grade-disputes`.
 */
export function createGradeDisputesApi(): GradeDisputesPort {
  return {
    async listPending(): Promise<GradeDispute[]> {
      const dtos = await request<GradeDisputeResponseDto[]>('/api/v1/academic/grade-disputes/teacher/pending');
      return dtos.map(fromDisputeResponse);
    },

    async decide(disputeId, decision): Promise<GradeDispute> {
      const body: TeacherDisputeDecisionRequestDto = {
        approved: decision.approuve,
        newValue: decision.nouvelleValeur,
        comment: decision.commentaire,
      };
      const dto = await request<GradeDisputeResponseDto>(
        `/api/v1/academic/grade-disputes/${encodeURIComponent(disputeId)}/teacher-decision`,
        { method: 'PUT', body },
      );
      return fromDisputeResponse(dto);
    },
  };
}
