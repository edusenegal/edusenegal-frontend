import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type { ClassPaymentStatsDto } from '@/types/api';
import type { PaymentConfigPort } from '@/services/ports';

/**
 * Portage réel partiel — taux de recouvrement agrégé ET par élève pour un
 * sous-ensemble d'élèves (débloque « Taux de paiement » sur
 * `ClassDetailPage`, agrégé et par élève — task #208). `get`/`save`
 * (configuration tarifaire, tâche #187) restent sur `createMockServices()`,
 * fusionnés dans `src/api/index.ts`.
 */
export function createPaymentsApi(): Pick<
  PaymentConfigPort,
  'getCollectionRateForStudents' | 'getPaymentRatesForStudents'
> {
  async function fetchStats(studentIds: string[], classId?: string): Promise<ClassPaymentStatsDto | null> {
    if (studentIds.length === 0) return null;
    const { schoolId } = sessionContext();
    const yearId = await resolveYearId();
    return request<ClassPaymentStatsDto>('/api/v1/payments/stats/by-students', {
      query: { schoolId, yearId, studentIds: studentIds.join(','), classId },
    });
  }

  return {
    async getCollectionRateForStudents(studentIds: string[], classId?: string): Promise<number | null> {
      const stats = await fetchStats(studentIds, classId);
      return stats ? stats.collectionRate : null;
    },

    async getPaymentRatesForStudents(studentIds: string[], classId?: string): Promise<Record<string, number>> {
      const stats = await fetchStats(studentIds, classId);
      const result: Record<string, number> = {};
      if (!stats) return result;
      for (const row of stats.byStudent) {
        result[row.studentId] = row.collectionRate;
      }
      return result;
    },
  };
}
