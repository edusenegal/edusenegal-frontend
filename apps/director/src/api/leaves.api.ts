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
  const path = url.split('?')[0] ?? url; // retire la query string d'une URL presignee
  const lastSegment = path.split('/').pop() ?? path;
  const separator = lastSegment.indexOf('_');
  return separator === -1 ? lastSegment : lastSegment.slice(separator + 1);
}

function firstDocumentPiece(documentUrls: string[]): { nom: string; url: string } | null {
  const firstUrl = documentUrls[0];
  return firstUrl ? { nom: fileNameFromDocumentUrl(firstUrl), url: firstUrl } : null;
}

function allDocumentPieces(documentUrls: string[]): { nom: string; url: string }[] {
  return documentUrls.map((url) => ({ nom: fileNameFromDocumentUrl(url), url }));
}

/**
 * `dto.reviewedBy` est un id utilisateur quelconque (DIRECTOR ou SUPERVISOR,
 * voir `jwt.getSubject()` dans `ScheduleServiceImpl#reviewLeave`), pas
 * forcément un enseignant -- `nameById` (construit depuis la seule liste des
 * enseignants) ne le résout donc pas toujours ; on retombe sur l'id brut,
 * comme `remplacant` le fait déjà pour le même genre de cas.
 */
function fromLeaveResponse(dto: LeaveRequestResponseDto, nameById: Map<string, string>): LeaveRequest {
  return {
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
    piecesJointes: allDocumentPieces(dto.documentUrls),
    traitePar: dto.reviewedBy ? nameById.get(dto.reviewedBy) ?? dto.reviewedBy : null,
    traiteLe: dto.reviewedAt ? isoToFR(dto.reviewedAt.slice(0, 10)) : null,
    noteDecision: dto.reviewNote,
  };
}

/** Congés & absences — `schedule-service`, `/api/v1/leaves/...` (voir `LeaveController`). */
export function createLeavesApi(): LeavesPort {
  return {
    async list(): Promise<LeaveRequest[]> {
      const { schoolId } = sessionContext();
      const [dtos, teachers] = await Promise.all([
        // CORRECTION (signalé) — « le directeur veut voir la liste des
        // demandes [de congé] et voir les états et les détails » :
        // `/pending` ne renvoyait jamais les demandes déjà traitées
        // (approuvées/rejetées), qui devenaient invisibles une fois
        // décidées. `/school/{schoolId}` (nouveau, voir LeaveController)
        // renvoie l'historique complet, le plus récent d'abord.
        request<LeaveRequestResponseDto[]>(`/api/v1/leaves/school/${encodeURIComponent(schoolId)}`),
        // Le serveur ne renvoie que l'id de l'enseignant (`teacherId`) --
        // jamais son nom : résolu ici, comme `subjectIds` -> noms ailleurs
        // dans l'application.
        createTeachersApi().list(),
      ]);
      const nameById = new Map(teachers.map((t) => [t.id, t.nom]));
      return dtos.map((dto) => fromLeaveResponse(dto, nameById));
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
      return fromLeaveResponse(dto, new Map());
    },
  };
}
