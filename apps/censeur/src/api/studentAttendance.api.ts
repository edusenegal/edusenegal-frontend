import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses } from '@/api/context';
import { createStudentsApi } from '@/api/students.api';
import { createSubjectsApi } from '@/api/subjects.api';
import { createTeachersApi } from '@/api/teachers.api';
import type {
  AbsenceRequestDto,
  AttendanceSessionResponseDto,
  AttendanceSheetResponseDto,
  AttendanceStatsResponseDto,
  AttendanceTrendPointResponseDto,
  ClassAttendanceStatsResponseDto,
} from '@/types/api';
import type { StudentAttendancePort } from '@/services/ports';
import type {
  AbsenceRequestSummary,
  AbsenceReviewStatus,
  AbsentStudentEntry,
  AttendanceSession,
  AttendanceTrendGranularity,
  AttendanceTrendPoint,
  ClassAttendanceRate,
  SchoolAttendanceOverview,
} from '@/types/domain';
import { isoToFR } from '@/utils/format';

/**
 * Jour de la séance (#426) — `AttendanceRecord.dayOfWeek` : le commentaire
 * du domaine backend indique un jour en français ("LUNDI"...), mais le code
 * réel (`String.valueOf(java.time.DayOfWeek)`) produit l'anglais
 * ("MONDAY"...) ; cette table couvre les deux pour ne jamais afficher une
 * valeur brute inattendue si l'un ou l'autre change.
 */
const DAY_LABEL_FR: Record<string, string> = {
  MONDAY: 'Lundi',
  TUESDAY: 'Mardi',
  WEDNESDAY: 'Mercredi',
  THURSDAY: 'Jeudi',
  FRIDAY: 'Vendredi',
  SATURDAY: 'Samedi',
  SUNDAY: 'Dimanche',
  LUNDI: 'Lundi',
  MARDI: 'Mardi',
  MERCREDI: 'Mercredi',
  JEUDI: 'Jeudi',
  VENDREDI: 'Vendredi',
  SAMEDI: 'Samedi',
  DIMANCHE: 'Dimanche',
};
function dayLabel(raw: string): string {
  return DAY_LABEL_FR[raw.toUpperCase()] ?? raw;
}

function toAttendanceSession(
  dto: AttendanceSessionResponseDto,
  classNameById: Map<string, string>,
  subjectNameById: Map<string, string>,
  teacherNameById: Map<string, string>,
): AttendanceSession {
  return {
    id: dto.id,
    classId: dto.classId,
    className: classNameById.get(dto.classId) ?? dto.classId,
    subjectId: dto.subjectId,
    matiere: dto.subjectId ? subjectNameById.get(dto.subjectId) ?? dto.subjectId : null,
    teacherId: dto.teacherId,
    professeur: dto.teacherId ? teacherNameById.get(dto.teacherId) ?? dto.teacherId : null,
    date: isoToFR(dto.date),
    dayOfWeek: dayLabel(dto.dayOfWeek),
    period: dto.period,
    totalStudents: dto.totalStudents,
    present: dto.present,
    absent: dto.absent,
    late: dto.late,
    attendanceRate: dto.attendanceRate,
  };
}

function toAttendanceTrendPoint(dto: AttendanceTrendPointResponseDto): AttendanceTrendPoint {
  return {
    periodStart: dto.periodStart,
    periodLabel: dto.periodLabel,
    totalStudents: dto.totalStudents,
    present: dto.present,
    absent: dto.absent,
    late: dto.late,
    attendanceRate: dto.attendanceRate,
  };
}

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

    async getSchoolSessions(from, to): Promise<AttendanceSession[]> {
      const { schoolId } = sessionContext();
      const [rows, classesDtos, subjects, teachers] = await Promise.all([
        request<AttendanceSessionResponseDto[]>('/api/v1/attendances/analytics/school/sessions', {
          query: { schoolId, from, to },
        }),
        fetchSchoolClasses(schoolId),
        createSubjectsApi().list(),
        createTeachersApi().list(),
      ]);
      const classNameById = new Map(classesDtos.map((c) => [c.id, c.fullName]));
      const subjectNameById = new Map(subjects.map((s) => [s.id, s.nom]));
      const teacherNameById = new Map(teachers.map((t) => [t.id, t.nom]));
      return rows.map((r) => toAttendanceSession(r, classNameById, subjectNameById, teacherNameById));
    },

    async getClassSessions(classId, from, to): Promise<AttendanceSession[]> {
      const { schoolId } = sessionContext();
      const [rows, classesDtos, subjects, teachers] = await Promise.all([
        request<AttendanceSessionResponseDto[]>(`/api/v1/attendances/analytics/class/${encodeURIComponent(classId)}/sessions`, {
          query: { schoolId, from, to },
        }),
        fetchSchoolClasses(schoolId),
        createSubjectsApi().list(),
        createTeachersApi().list(),
      ]);
      const classNameById = new Map(classesDtos.map((c) => [c.id, c.fullName]));
      const subjectNameById = new Map(subjects.map((s) => [s.id, s.nom]));
      const teacherNameById = new Map(teachers.map((t) => [t.id, t.nom]));
      return rows.map((r) => toAttendanceSession(r, classNameById, subjectNameById, teacherNameById));
    },

    async getSchoolTrend(from, to, granularity: AttendanceTrendGranularity): Promise<AttendanceTrendPoint[]> {
      const { schoolId } = sessionContext();
      const rows = await request<AttendanceTrendPointResponseDto[]>('/api/v1/attendances/analytics/school/trend', {
        query: { schoolId, from, to, granularity },
      });
      return rows.map(toAttendanceTrendPoint);
    },

    async getClassTrend(classId, from, to, granularity: AttendanceTrendGranularity): Promise<AttendanceTrendPoint[]> {
      const { schoolId } = sessionContext();
      const rows = await request<AttendanceTrendPointResponseDto[]>(
        `/api/v1/attendances/analytics/class/${encodeURIComponent(classId)}/trend`,
        { query: { schoolId, from, to, granularity } },
      );
      return rows.map(toAttendanceTrendPoint);
    },
  };
}
