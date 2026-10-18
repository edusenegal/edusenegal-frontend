import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import { toAppError } from '@/services/errors';
import type { ApiAttendanceStatus, AttendanceSheetResponseDto, MarkAttendanceRequestDto } from '@/types/api';
import type { AttendancePort } from '@/services/ports';
import type { AttendanceStatus, AttendanceStudentEntry } from '@/types/domain';

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
      await request<unknown>('/api/v1/attendances/mark', { method: 'POST', body });
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
  };
}
