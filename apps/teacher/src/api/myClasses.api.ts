import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses } from '@/api/context';
import type { UserResponseDto } from '@/types/api';
import type { MyClassesPort } from '@/services/ports';
import type { MyClass, StudentRosterEntry } from '@/types/domain';

/**
 * "Mes classes" — `UserResponse` n'expose pas de `classIds` pour un
 * enseignant (seulement `subjectIds`, voir `auth.api.ts`) : on résout
 * l'appartenance en filtrant `ClassInfoDto.teacherIds` côté frontend, comme
 * `apps/director` le fait déjà pour les élèves (`fetchSchoolClasses` +
 * filtre, voir son `students.api.ts`).
 */
export function createMyClassesApi(): MyClassesPort {
  return {
    async list(): Promise<MyClass[]> {
      const { schoolId, userId } = sessionContext();
      const classes = await fetchSchoolClasses(schoolId);
      return classes
        .filter((c) => c.teacherIds.includes(userId))
        .map((c) => ({
          id: c.id,
          nom: c.fullName,
          level: c.level,
          series: c.series,
          effectif: c.studentIds.length,
          estPrincipal: c.homeroomTeacherId === userId,
        }));
    },

    /**
     * Roster d'une classe : `GET /class/{classId}/students` (user-service)
     * ne rend que des ids — chacun est résolu en nom via `GET /users/{id}`,
     * route elle aussi ouverte au rôle enseignant sans restriction
     * supplémentaire (voir `UserController#getUser`). Pas de route "bulk"
     * côté backend à ce jour.
     */
    async roster(classId: string): Promise<StudentRosterEntry[]> {
      const studentIds = await request<string[]>(`/api/v1/users/class/${encodeURIComponent(classId)}/students`);
      const students = await Promise.all(
        studentIds.map((id) => request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(id)}`)),
      );
      return students
        .map((s) => ({ id: s.id, prenom: s.firstName, nom: s.lastName }))
        .sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
    },
  };
}
