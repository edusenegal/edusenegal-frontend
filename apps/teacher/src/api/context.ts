import { request, sessionContext } from '@/api/client';
import type { AcademicYearDto, ClassInfoDto } from '@/types/api';

/**
 * Année scolaire active — résolue une fois par session (même convention que
 * `apps/director`/`apps/comptable`, voir leur `api/context.ts`).
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
 * Toutes les classes de l'école (année active) — `UserResponse` n'a pas de
 * champ `classIds` pour un enseignant ; "mes classes" se résout en filtrant
 * `ClassInfoDto.teacherIds` côté frontend (voir `myClasses.api.ts`).
 */
export async function fetchSchoolClasses(schoolId: string): Promise<ClassInfoDto[]> {
  const yearId = await resolveYearId();
  return request<ClassInfoDto[]>(
    `/api/v1/classes/school/${encodeURIComponent(schoolId)}/year/${encodeURIComponent(yearId)}`,
  );
}
