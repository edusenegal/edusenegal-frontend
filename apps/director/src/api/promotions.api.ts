import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses } from '@/api/context';
import type { ClassInfoDto, ClassResponseDto } from '@/types/api';
import type { PromotionsPort } from '@/services/ports';

async function enroll(classId: string, studentId: string): Promise<void> {
  await request<ClassResponseDto>(
    `/api/v1/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
    { method: 'POST' },
  );
}

async function unenroll(classId: string, studentId: string): Promise<void> {
  await request<ClassResponseDto>(
    `/api/v1/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
    { method: 'DELETE' },
  );
}

function findClassOf(classesDtos: ClassInfoDto[], studentId: string): ClassInfoDto | undefined {
  return classesDtos.find((c) => c.studentIds.includes(studentId));
}

/**
 * Portage réel (task #233).
 *
 * « Promouvoir » n'est, côté backend, rien de plus qu'un déplacement de
 * classe à classe — mécaniquement identique au transfert interne exécuté
 * par `TransfersPage` après `executeInternal` : désinscription puis
 * inscription (`class-service`, `POST`/`DELETE
 * /api/v1/classes/{classId}/students/{studentId}`, déjà réels — voir
 * `createClassesApi`). Sans champ direct « classe actuelle » sur
 * `UserResponse`, la classe de départ est retrouvée en balayant
 * `ClassInfoDto.studentIds` (même détour que `students.api.ts`, via
 * `fetchSchoolClasses`).
 *
 * Aucun rapport avec la clôture d'année (task #234, saga `academic-service`
 * + Kafka `year.closing`/`year.closed`) : ceci reste un acte manuel, ponctuel,
 * hors de toute clôture — ni calcul de moyenne, ni passage exceptionnel.
 */
export function createPromotionsApi(): PromotionsPort {
  return {
    async promoteClass(fromClassId, toClassId): Promise<{ moved: number }> {
      const { schoolId } = sessionContext();
      const classesDtos = await fetchSchoolClasses(schoolId);
      const fromClass = classesDtos.find((c) => c.id === fromClassId);
      const studentIds = fromClass?.studentIds ?? [];
      // Séquentiel plutôt que `Promise.all` : chaque élève fait un aller-retour
      // désinscription + inscription sur le même service — éviter une rafale
      // de requêtes concurrentes sur la même classe (deux écritures Mongo sur
      // le même document `SchoolClass`, voir `ClassServiceImpl`).
      for (const studentId of studentIds) {
        await unenroll(fromClassId, studentId);
        await enroll(toClassId, studentId);
      }
      return { moved: studentIds.length };
    },

    async promoteStudent(studentId, toClassId): Promise<void> {
      const { schoolId } = sessionContext();
      const classesDtos = await fetchSchoolClasses(schoolId);
      const fromClass = findClassOf(classesDtos, studentId);
      if (fromClass) {
        await unenroll(fromClass.id, studentId);
      }
      await enroll(toClassId, studentId);
    },
  };
}
