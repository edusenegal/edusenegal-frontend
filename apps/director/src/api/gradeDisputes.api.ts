import { request, sessionContext } from '@/api/client';
import type { EscalatedDisputeDecisionRequestDto, GradeDisputeResponseDto, UserResponseDto } from '@/types/api';
import type { GradeDisputesPort } from '@/services/ports';
import type { GradeDispute, GradeDisputeStatus } from '@/types/domain';

const STATUS_TO_DOMAIN: Record<GradeDisputeResponseDto['status'], GradeDisputeStatus> = {
  PENDING_TEACHER: 'pending_teacher',
  PENDING_SUPERVISOR: 'pending_supervisor',
  PENDING_DIRECTOR: 'pending_director',
  PENDING_TEACHER_DIRECTED: 'pending_teacher_directed',
  RESOLVED_APPROVED: 'resolved_approved',
  RESOLVED_REJECTED: 'resolved_rejected',
};

const ACTION_TO_API: Record<'reject' | 'order_correction', EscalatedDisputeDecisionRequestDto['action']> = {
  reject: 'REJECT',
  order_correction: 'ORDER_CORRECTION',
};

async function resolveUserName(userId: string): Promise<string> {
  try {
    const user = await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(userId)}`);
    return `${user.firstName} ${user.lastName}`;
  } catch {
    return '—';
  }
}

async function fromApiDispute(dto: GradeDisputeResponseDto): Promise<GradeDispute> {
  const [studentNom, teacherNom] = await Promise.all([resolveUserName(dto.studentId), resolveUserName(dto.teacherId)]);
  return {
    id: dto.id,
    gradeId: dto.gradeId,
    studentId: dto.studentId,
    studentNom,
    classId: dto.classId,
    classNom: dto.classId,
    subjectId: dto.subjectId,
    subjectNom: dto.subjectName ?? dto.subjectId,
    teacherId: dto.teacherId,
    teacherNom,
    disputedValue: dto.disputedValue,
    currentValue: dto.currentValue,
    reason: dto.reason,
    status: STATUS_TO_DOMAIN[dto.status],
    history: dto.history.map((h) => ({ action: h.action, actorId: h.actorId, actorRole: h.actorRole, comment: h.comment, at: h.at })),
    createdAt: dto.createdAt,
    resolvedAt: dto.resolvedAt,
  };
}

/**
 * Réclamations de notes (demande explicite) — décision du directeur
 * uniquement (niveau 3) : `GradeDisputeController#directorDecide`. Le
 * professeur et le surveillant général/censeur statuent depuis leurs
 * propres écrans (hors de cette application, strictement réservée au rôle
 * DIRECTOR — voir `DirectorProfile.role`).
 */
export function createGradeDisputesApi(): GradeDisputesPort {
  return {
    async listPendingDirector(): Promise<GradeDispute[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<GradeDisputeResponseDto[]>(
        `/api/v1/academic/grade-disputes/school/${encodeURIComponent(schoolId)}/pending-director`,
      );
      return Promise.all(dtos.map(fromApiDispute));
    },

    async decide(disputeId, action, comment): Promise<GradeDispute> {
      const body: EscalatedDisputeDecisionRequestDto = { action: ACTION_TO_API[action], comment: comment?.trim() || null };
      const dto = await request<GradeDisputeResponseDto>(
        `/api/v1/academic/grade-disputes/${encodeURIComponent(disputeId)}/director-decision`,
        { method: 'PUT', body },
      );
      return fromApiDispute(dto);
    },
  };
}
