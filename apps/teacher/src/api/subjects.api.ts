import { request } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import type { SubjectResponseDto } from '@/types/api';
import type { SubjectsPort } from '@/services/ports';
import type { Subject } from '@/types/domain';

function fromSubjectResponse(dto: SubjectResponseDto): Subject {
  return { id: dto.id, code: dto.code, nom: dto.names['fr'] ?? dto.code };
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
      const subjects = await Promise.all(
        subjectIds.map((id) => request<SubjectResponseDto>(`/api/v1/subjects/${encodeURIComponent(id)}`)),
      );
      return subjects.map(fromSubjectResponse);
    },
  };
}
