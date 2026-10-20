import { request, sessionContext } from '@/api/client';
import { createTeachersApi } from '@/api/teachers.api';
import type { LeaveRequestResponseDto, ReviewLeaveRequestDto } from '@/types/api';
import type { LeavesPort } from '@/services/ports';
import type { LeaveRequest, LeaveStatus } from '@/types/domain';
import { isoToFR } from '@/utils/format';

const STATUS_FROM_API: Record<string, LeaveStatus> = {
  PENDING: 'en_attente',
  APPROVED: 'approuve',
  REJECTED: 'rejete',
};

/**
 * Nom de fichier lisible à partir de la clé de stockage (`storageService.
 * upload` compose la clé en `leaves/{teacherId}/{epochSeconds}_{nomOriginal}`
 * -- voir `ScheduleServiceImpl.createLeave`). Aucun endpoint de
 * téléchargement n'existe pour ces pièces jointes : seul le nom est affiché,
 * comme le fait déjà l'écran.
 */
function fileNameFromDocumentUrl(url: string): string {
  const lastSegment = url.split('/').pop() ?? url;
  const separator = lastSegment.indexOf('_');
  return separator === -1 ? lastSegment : lastSegment.slice(separator + 1);
}

function firstDocumentPiece(documentUrls: string[]): { nom: string } | null {
  const firstUrl = documentUrls[0];
  return firstUrl ? { nom: fileNameFromDocumentUrl(firstUrl) } : null;
}

/** Congés & absences — `schedule-service`, `/api/v1/leaves/...` (voir `LeaveController`). */
export function createLeavesApi(): LeavesPort {
  return {
    async list(): Promise<LeaveRequest[]> {
      const { schoolId } = sessionContext();
      const [dtos, teachers] = await Promise.all([
        request<LeaveRequestResponseDto[]>(`/api/v1/leaves/school/${encodeURIComponent(schoolId)}/pending`),
        // Le serveur ne renvoie que l'id de l'enseignant (`teacherId`) --
        // jamais son nom : résolu ici, comme `subjectIds` -> noms ailleurs
        // dans l'application.
        createTeachersApi().list(),
      ]);
      const nameById = new Map(teachers.map((t) => [t.id, t.nom]));

      return dtos.map((dto) => ({
        id: dto.id,
        teacherId: dto.teacherId,
        teacherNom: nameById.get(dto.teacherId) ?? dto.teacherId,
        dateDebut: isoToFR(dto.startDate),
        dateFin: isoToFR(dto.endDate),
        motif: dto.reason,
        statut: STATUS_FROM_API[dto.status] ?? 'en_attente',
        remplacant: dto.replacementTeacherId ? nameById.get(dto.replacementTeacherId) ?? dto.replacementTeacherId : null,
        remplacantId: dto.replacementTeacherId,
        pieceJointe: firstDocumentPiece(dto.documentUrls),
      }));
    },

    async review(leaveId, approve, replacementTeacherId): Promise<LeaveRequest> {
      const body: ReviewLeaveRequestDto = {
        status: approve ? 'APPROVED' : 'REJECTED',
        ...(approve && replacementTeacherId ? { replacementTeacherId } : {}),
      };
      const dto = await request<LeaveRequestResponseDto>(`/api/v1/leaves/${encodeURIComponent(leaveId)}/review`, {
        method: 'PUT',
        body,
      });
      return {
        id: dto.id,
        teacherId: dto.teacherId,
        teacherNom: dto.teacherId,
        dateDebut: isoToFR(dto.startDate),
        dateFin: isoToFR(dto.endDate),
        motif: dto.reason,
        statut: STATUS_FROM_API[dto.status] ?? 'en_attente',
        remplacant: dto.replacementTeacherId ?? null,
        remplacantId: dto.replacementTeacherId,
        pieceJointe: firstDocumentPiece(dto.documentUrls),
      };
    },
  };
}
