import { request, sessionContext } from '@/api/client';
import type { AcademicYearDto, ClassInfoDto } from '@/types/api';

/**
 * Année scolaire active — résolue une fois par session.
 *
 * Elle ne figure pas dans le jeton (voir `sessionContext`), alors que
 * presque tous les ports la réclament (`academicYearId`). La résoudre à
 * chaque appel multiplierait les requêtes ; on la mémorise, et le cache se
 * vide avec la session (déconnexion = nouveau `schoolId` au prochain login,
 * donc un cache qui ne correspond plus jamais).
 */
let yearCache: { schoolId: string; yearId: string } | null = null;

export async function resolveYearId(): Promise<string> {
  const { schoolId } = sessionContext();
  if (yearCache?.schoolId === schoolId) {
    return yearCache.yearId;
  }

  const year = await request<AcademicYearDto>(
    `/api/v1/schools/${encodeURIComponent(schoolId)}/academic-years/active`,
  );
  yearCache = { schoolId, yearId: year.id };
  return year.id;
}

export function clearContextCache(): void {
  yearCache = null;
}

/**
 * Toutes les classes de l'école (année active) — utilisé par plusieurs
 * ports (élèves, enseignants) pour résoudre une appartenance à une classe
 * côté frontend, faute d'un champ direct sur `UserResponse` (voir
 * `students.api.ts`/`teachers.api.ts`).
 */
export async function fetchSchoolClasses(schoolId: string): Promise<ClassInfoDto[]> {
  const yearId = await resolveYearId();
  return request<ClassInfoDto[]>(
    `/api/v1/classes/school/${encodeURIComponent(schoolId)}/year/${encodeURIComponent(yearId)}`,
  );
}
