import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import { toAppError } from '@/services/errors';
import type {
  ApiAttendanceStatus,
  AttendanceRecordDto,
  AttendanceSheetResponseDto,
  MarkAttendanceRequestDto,
} from '@/types/api';
import type { AttendancePort } from '@/services/ports';
import type { AttendanceSession, AttendanceStatus, AttendanceStudentEntry } from '@/types/domain';

const STATUS_TO_API: Record<AttendanceStatus, ApiAttendanceStatus> = {
  present: 'PRESENT',
  absent: 'ABSENT',
  retard: 'LATE',
  justifie: 'JUSTIFIED',
};
const STATUS_FROM_API: Record<ApiAttendanceStatus, AttendanceStatus> = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'retard',
  JUSTIFIED: 'justifie',
};

/** `date` (yyyy-mm-dd) → jour de semaine anglais majuscule attendu par `java.time.DayOfWeek`. */
function dayOfWeekOf(dateISO: string): string {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[new Date(`${dateISO}T00:00:00`).getDay()] ?? 'MONDAY';
}

/** Appel et consultation de l'appel — `attendance-service`, `/api/v1/attendances`. */
export function createAttendanceApi(): AttendancePort {
  return {
    async mark(input): Promise<void> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const body: MarkAttendanceRequestDto = {
        schoolId,
        classId: input.classId,
        academicYearId,
        subjectId: input.subjectId,
        date: input.date,
        dayOfWeek: dayOfWeekOf(input.date),
        period: input.period,
        students: input.eleves.map((e) => ({
          studentId: e.studentId,
          status: STATUS_TO_API[e.statut],
          note: e.note,
        })),
      };
      // CORRECTION #401 : on appelait toujours /mark, qui CRÉE un nouvel
      // AttendanceRecord à chaque appel. Rouvrir l'historique d'une classe
      // déjà appelée et corriger un élève (ou simplement re-soumettre)
      // créait donc un DOUBLON du même créneau, compté deux fois dans
      // toutes les statistiques (école, classe, élève). /sync applique le
      // même corps mais fait un UPSERT sur (école, classe, matière, date,
      // créneau) — exactement ce qu'il faut pour « faire l'appel » comme
      // pour « corriger l'appel déjà fait ».
      await request<AttendanceRecordDto>('/api/v1/attendances/sync', { method: 'POST', body });
    },

    async getSheet(classId, subjectId, date) {
      try {
        const dto = await request<AttendanceSheetResponseDto>('/api/v1/attendances/analytics/class/sheet', {
          query: { schoolId: sessionContext().schoolId, classId, date },
        });
        if (dto.subjectId && dto.subjectId !== subjectId) {
          return null;
        }
        return {
          totalStudents: dto.totalStudents,
          present: dto.present,
          absent: dto.absent,
          attendanceRate: dto.attendanceRate,
          students: dto.students.map<AttendanceStudentEntry>((s) => ({
            studentId: s.studentId,
            statut: STATUS_FROM_API[s.status],
            note: s.note ?? undefined,
          })),
        };
      } catch (error) {
        const appError = toAppError(error);
        if (appError.kind === 'notFound') {
          return null;
        }
        throw appError;
      }
    },

    /** Historique de l'appel déjà saisi par ce professeur — item #401. */
    async getHistory(from, to): Promise<AttendanceSession[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<AttendanceRecordDto[]>('/api/v1/attendances/analytics/teacher/history', {
        query: { schoolId, from, to },
      });
      return dtos
        .map((dto) => ({
          id: dto.id,
          classId: dto.classId,
          subjectId: dto.subjectId,
          subjectName: dto.subjectName ?? undefined,
          date: dto.date,
          period: dto.period,
          locked: dto.locked ?? false,
          students: dto.records.map((r) => ({
            studentId: r.studentId,
            statut: STATUS_FROM_API[r.status],
            note: r.note ?? undefined,
          })),
        }))
        .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
    },
  };
}
