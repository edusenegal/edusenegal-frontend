import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import { AppError } from '@/services/errors';
import type { AcademicConfigInfo, AcademicConfigPort } from '@/services/ports';

/** Réponse partielle de `GET /academic/config/effective` — on ne lit que ce
 *  dont la saisie de notes a besoin (nombre de périodes + libellé). */
interface EffectiveConfigDto {
  semesterCount?: number;
  periodType?: 'SEMESTER' | 'TRIMESTER' | 'ANNUAL';
}

/**
 * Configuration académique effective (école → niveau → classe) — lecture
 * seule pour l'espace enseignant : combien de semestres/trimestres la
 * direction a configurés, afin que la saisie de notes ne propose QUE ces
 * périodes (plus de « Semestre 4 » fantôme si l'école n'en a que deux).
 */
export function createAcademicConfigApi(): AcademicConfigPort {
  return {
    async getEffective(classId?: string): Promise<AcademicConfigInfo | null> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      try {
        const dto = await request<EffectiveConfigDto>('/api/v1/academic/config/effective', {
          query: { schoolId, yearId, classId },
        });
        const count = Math.min(Math.max(dto.semesterCount ?? 2, 1), 4);
        return {
          periodCount: count,
          periodLabel: dto.periodType === 'TRIMESTER' ? 'Trimestre' : 'Semestre',
        };
      } catch (err) {
        // Aucune config posée (début d'année) → 422 BusinessException : état normal.
        if (err instanceof AppError && err.kind === 'validation') return null;
        throw err;
      }
    },
  };
}
