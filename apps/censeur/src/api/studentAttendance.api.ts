import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses } from '@/api/context';
import { createStudentsApi } from '@/api/students.api';
import type {
  AbsenceRequestDto,
  AttendanceSheetResponseDto,
  AttendanceStatsResponseDto,
  ClassAttendanceStatsResponseDto,
} from '@/types/api';
import type { StudentAttendancePort } from '@/services/ports';
import type {
  AbsenceRequestSummary,
  AbsenceReviewStatus,
  AbsentStudentEntry,
  ClassAttendanceRate,
  SchoolAttendanceOverview,
} from '@/types/domain';
import { isoToFR } from '@/utils/format';

function fromAbsenceDto(dto: AbsenceRequestDto, nameById: Map<string, string>): AbsenceRequestSummary {
  return {
    id: dto.id,
    studentId: dto.studentId,
    studentNom: nameById.get(dto.studentId) ?? dto.studentId,
    schoolId: dto.schoolId,
    dateFrom: isoToFR(dto.absenceDateFrom),
    dateTo: isoToFR(dto.absenceDateTo),
    reason: dto.reason,
    hasJustification: dto.justificationUrl !== null,
    status: dto.status,
    reviewedBy: dto.reviewedBy,
    reviewedAt: dto.reviewedAt,
  };
}

/**
 * Portage réel (items #400/#402) — attendance-service, via l'api-gateway.
 *
 * `getClassesStats`/`getAbsentStudents` résolvent les noms de classe/élève
 * côté client : le backend ne renvoie que des `classId`/`studentId` (aucun
 * service n'agrège "nom + taux" en un seul appel).
 */
export function createStudentAttendanceApi(): StudentAttendancePort {
  return {
    async getSchoolStats(from, to): Promise<SchoolAttendanceOverview> {
      const { schoolId } = sessionContext();
      const dto = await request<AttendanceStatsResponseDto>('/api/v1/attendances/analytics/school/stats', {
        query: { schoolId, from, to },
      });
      return {
        from: dto.from,
        to: dto.to,
        totalRecords: dto.totalRecords,
        present: dto.totalPresent,
        absent: dto.totalAbsent,
        late: dto.totalLate,
        attendanceRate: dto.attendanceRate,
      };
    },

    async getClassesStats(from, to): Promise<ClassAttendanceRate[]> {
      const { schoolId } = sessionContext();
      const [rows, classesDtos] = await Promise.all([
        request<ClassAttendanceStatsResponseDto[]>('/api/v1/attendances/analytics/school/classes-stats', {
          query: { schoolId, from, to },
        }),
        fetchSchoolClasses(schoolId),
      ]);
      const nameById = new Map(classesDtos.map((c) => [c.id, c.fullName]));
      return rows.map((r) => ({
        classId: r.classId,
        className: nameById.get(r.classId) ?? r.classId,
        totalStudents: r.totalStudents,
        present: r.present,
        absent: r.absent,
        late: r.late,
        attendanceRate: r.attendanceRate,
      }));
    },

    async getAbsentStudents(classId, from, to): Promise<AbsentStudentEntry[]> {
      const { schoolId } = sessionContext();
      const [sheet, students] = await Promise.all([
        request<AttendanceSheetResponseDto>('/api/v1/attendances/analytics/class/sheet/range', {
          query: { schoolId, classId, from, to },
        }),
        createStudentsApi().list(classId),
      ]);
      const nameById = new Map(students.map((s) => [s.id, `${s.prenom} ${s.nom}`]));
      return sheet.students
        .filter((s) => s.status === 'ABSENT' || s.status === 'LATE')
        .map((s) => ({
          studentId: s.studentId,
          studentNom: nameById.get(s.studentId) ?? s.studentId,
          status: s.status,
          note: s.note,
        }));
    },

    async listSchoolAbsences(status?: AbsenceReviewStatus): Promise<AbsenceRequestSummary[]> {
      const { schoolId } = sessionContext();
      const [dtos, students] = await Promise.all([
        request<AbsenceRequestDto[]>(`/api/v1/attendances/absence/school/${encodeURIComponent(schoolId)}`, {
          query: status ? { status } : undefined,
        }),
        createStudentsApi().list(),
      ]);
      const nameById = new Map(students.map((s) => [s.id, `${s.prenom} ${s.nom}`]));
      return dtos
        .map((dto) => fromAbsenceDto(dto, nameById))
        .sort((a, b) => b.dateFrom.localeCompare(a.dateFrom));
    },

    async reviewAbsence(absenceId, status): Promise<AbsenceRequestSummary> {
      const dto = await request<AbsenceRequestDto>(
        `/api/v1/attendances/absence/${encodeURIComponent(absenceId)}/review`,
        { method: 'PUT', query: { status } },
      );
      const students = await createStudentsApi().list();
      const nameById = new Map(students.map((s) => [s.id, `${s.prenom} ${s.nom}`]));
      return fromAbsenceDto(dto, nameById);
    },
  };
}
