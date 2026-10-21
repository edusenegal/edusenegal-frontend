import { request } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import type { SubjectResponseDto } from '@/types/api';
import type { SubjectsPort } from '@/services/ports';
import type { Subject } from '@/types/domain';

function fromSubjectResponse(dto: SubjectResponseDto): Subject {
  return {
    id: dto.id,
    code: dto.code,
    nom: dto.names['fr'] ?? dto.code,
    coefficients: (dto.coefficients ?? []).map((c) => ({
      classeId: c.classId,
      valeur: c.value,
      enseignee: c.active,
    })),
  };
}

/**
 * Matières du professeur connecté — `subjectIds` vient de son profil
 * (`UserResponseDto.subjectIds`, posé par `auth.api.ts`), résolu ici en
 * objets `Subject` via `GET /subjects/{id}` (subject-service).
 */
export function createSubjectsApi(): SubjectsPort {
  return {
    async listMine(): Promise<Subject[]> {
      const teacher = useAuthStore.getState().teacher;
      const subjectIds = teacher?.subjectIds ?? [];
      if (subjectIds.length === 0) {
        return [];
      }
      // CORRECTION (défensif, lié au signalement "la matière c'est l'id qui
      // est là") : Promise.all faisait échouer la liste ENTIÈRE dès qu'un
      // seul subjectId du profil ne se résolvait plus (matière supprimée,
      // désassignée...) -- plus aucune matière n'était alors jamais
      // affichée, nulle part dans l'application. Un identifiant orphelin ne
      // doit faire disparaître que lui-même, pas toutes les matières du
      // professeur.
      const settled = await Promise.allSettled(
        subjectIds.map((id) => request<SubjectResponseDto>(`/api/v1/subjects/${encodeURIComponent(id)}`)),
      );
      return settled
        .filter((r): r is PromiseFulfilledResult<SubjectResponseDto> => r.status === 'fulfilled')
        .map((r) => fromSubjectResponse(r.value));
    },
  };
}
