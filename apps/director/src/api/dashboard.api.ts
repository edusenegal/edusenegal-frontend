import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses, resolveYearId } from '@/api/context';
import type { ApiPage, AttendanceStatsResponseDto, LedgerResponseDto, UserResponseDto } from '@/types/api';
import type { DashboardPort } from '@/services/ports';
import type { DashboardSnapshot } from '@/types/domain';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Taux de présence d'une seule journée (`from === to`) — 0 si rien n'a été saisi ce jour-là. */
async function attendanceRateFor(schoolId: string, day: Date): Promise<number> {
  const iso = isoDate(day);
  const stats = await request<AttendanceStatsResponseDto>('/api/v1/attendances/analytics/school/stats', {
    query: { schoolId, from: iso, to: iso },
  });
  return stats.totalRecords > 0 ? Math.round(stats.attendanceRate * 10) / 10 : 0;
}

/**
 * Portage réel (task #236) — composé entièrement côté client : aucun
 * endpoint n'agrège ces six chiffres côté backend.
 *
 *   - effectif (total + G/F)    : user-service, GET /users/school/{id}?role=STUDENT
 *   - présence du jour + veille : attendance-service, GET /attendances/analytics/school/stats
 *                                 (deux appels, from=to, pour calculer la variation)
 *   - solde de caisse           : payment-service, GET /accounting/ledger
 *   - demandes en attente       : congés en attente (schedule-service,
 *                                 GET /leaves/school/{id}/pending) + demandes de salaire
 *                                 PENDING_VALIDATION (payment-service, GET /accounting/salary-requests).
 *                                 Les demandes de transfert EXTERNE ne comptent pas :
 *                                 TransferController (academic-service) n'expose qu'un
 *                                 aperçu/exécution par élève, aucune liste/comptage des
 *                                 demandes en attente — gap backend réel, non bloquant pour
 *                                 cette tuile (cf. seed_flows.py, note équivalente côté seed).
 *   - classes / enseignants     : repris ici directement (TEACHER + INSTITUTEUR, comme
 *                                 `createTeachersApi().list()`) plutôt que de dépendre d'un
 *                                 autre port déjà résolu ailleurs dans l'app.
 */
export function createDashboardApi(): DashboardPort {
  return {
    async getSnapshot(): Promise<DashboardSnapshot> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const [students, teacherDtos, instituteurDtos, classesDtos, presenceDuJour, presenceHier, ledger, pendingLeaves, salaryPage] =
        await Promise.all([
          request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(schoolId)}`, {
            query: { role: 'STUDENT' },
          }),
          request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(schoolId)}`, {
            query: { role: 'TEACHER' },
          }),
          request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(schoolId)}`, {
            query: { role: 'INSTITUTEUR' },
          }),
          fetchSchoolClasses(schoolId),
          attendanceRateFor(schoolId, today),
          attendanceRateFor(schoolId, yesterday),
          request<LedgerResponseDto>('/api/v1/accounting/ledger', {
            query: { schoolId, academicYearId: yearId },
          }),
          request<unknown[]>(`/api/v1/leaves/school/${encodeURIComponent(schoolId)}/pending`),
          request<ApiPage<unknown>>('/api/v1/accounting/salary-requests', {
            query: { schoolId, academicYearId: yearId, status: 'PENDING_VALIDATION', size: 1 },
          }),
        ]);

      const effectifGarcons = students.filter((u) => u.sexe === 'MASCULIN').length;

      return {
        effectifTotal: students.length,
        effectifGarcons,
        effectifFilles: students.length - effectifGarcons,
        presenceDuJour,
        presenceDuJourVariation: Math.round((presenceDuJour - presenceHier) * 10) / 10,
        soldeCaisse: ledger.balanceFcfa,
        demandesEnAttente: (pendingLeaves?.length ?? 0) + (salaryPage?.totalElements ?? 0),
        classesCount: classesDtos.length,
        enseignantsCount: teacherDtos.length + instituteurDtos.length,
      };
    },
  };
}
