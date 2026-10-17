import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses } from '@/api/context';
import type { CreateSubjectRequestDto, SubjectResponseDto, UpdateCoefficientsRequestDto } from '@/types/api';
import type { SubjectsPort } from '@/services/ports';
import type { Subject, SubjectCoefficient } from '@/types/domain';

function fromSubjectResponse(dto: SubjectResponseDto): Subject {
  return {
    id: dto.id,
    code: dto.code,
    nom: dto.names?.fr ?? dto.code,
    optionnelle: dto.optional,
    global: dto.global,
    coefficients: (dto.coefficients ?? []).map((c) => ({
      classeId: c.classId,
      valeur: c.value,
      enseignee: c.active,
    })),
  };
}

/**
 * Portage réel — `subject-service` (`SubjectController`). Les routes
 * existent toutes sous `/api/v1/subjects` : le commentaire de `ports.ts`
 * omettait ce préfixe (`POST /subjects` au lieu de `POST /api/v1/subjects`).
 */
export function createSubjectsApi(): SubjectsPort {
  return {
    async list(): Promise<Subject[]> {
      const { schoolId } = sessionContext();
      // Rend déjà les matières de l'école ET le catalogue global combinés.
      const dtos = await request<SubjectResponseDto[]>(`/api/v1/subjects/school/${encodeURIComponent(schoolId)}`);
      return dtos.map(fromSubjectResponse);
    },

    async get(subjectId: string): Promise<Subject> {
      const dto = await request<SubjectResponseDto>(`/api/v1/subjects/${encodeURIComponent(subjectId)}`);
      return fromSubjectResponse(dto);
    },

    async create(input): Promise<Subject> {
      const { schoolId } = sessionContext();
      const body: CreateSubjectRequestDto = {
        schoolId,
        code: input.code,
        names: { fr: input.nom },
        // Cette application ne gère que des lycées (voir `classes.api.ts`).
        schoolTypeScope: 'LYCEE',
        optional: input.optionnelle,
        isGlobal: false,
      };
      const dto = await request<SubjectResponseDto>('/api/v1/subjects', { method: 'POST', body });
      return fromSubjectResponse(dto);
    },

    async setCoefficients(subjectId: string, coefficients: SubjectCoefficient[]): Promise<Subject> {
      const { schoolId } = sessionContext();
      // `CoefficientEntry` porte level/series/tag — résolus depuis la classe
      // visée (le frontend n'en saisit que value/active par classe).
      const classesDtos = await fetchSchoolClasses(schoolId);
      const classById = new Map(classesDtos.map((c) => [c.id, c]));
      const body: UpdateCoefficientsRequestDto = {
        coefficients: coefficients.map((c) => {
          const cls = classById.get(c.classeId);
          return {
            classId: c.classeId,
            level: cls?.level ?? null,
            series: cls?.series ?? null,
            tag: cls?.tag ?? null,
            value: c.valeur,
            active: c.enseignee,
          };
        }),
      };
      const dto = await request<SubjectResponseDto>(
        `/api/v1/subjects/${encodeURIComponent(subjectId)}/coefficients`,
        { method: 'PUT', body },
      );
      return fromSubjectResponse(dto);
    },

    async remove(subjectId: string): Promise<void> {
      await request<void>(`/api/v1/subjects/${encodeURIComponent(subjectId)}`, { method: 'DELETE' });
    },
  };
}
