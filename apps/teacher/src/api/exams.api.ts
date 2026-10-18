import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses, resolveYearId } from '@/api/context';
import type { ApiExamType, ExamCalendarResponseDto, ScheduleExamRequestDto } from '@/types/api';
import type { ExamsPort } from '@/services/ports';
import type { ExamEvent, ExamType } from '@/types/domain';
import { isoToFR } from '@/utils/format';

const TYPE_TO_API: Record<ExamType, ApiExamType> = {
  devoir1: 'DEVOIR1',
  devoir2: 'DEVOIR2',
  composition: 'COMPOSITION',
  interro: 'INTERRO',
  examen_blanc: 'EXAMEN_BLANC',
  conseil_de_classe: 'CONSEIL_DE_CLASSE',
};
const TYPE_FROM_API: Record<ApiExamType, ExamType> = Object.fromEntries(
  Object.entries(TYPE_TO_API).map(([k, v]) => [v, k]),
) as Record<ApiExamType, ExamType>;

function fromExamResponse(dto: ExamCalendarResponseDto, classNameById: Map<string, string>): ExamEvent {
  return {
    id: dto.id,
    classe: classNameById.get(dto.classId) ?? '—',
    matiere: dto.subjectName,
    titre: dto.title,
    type: TYPE_FROM_API[dto.type] ?? 'devoir1',
    semestre: dto.semesterNumber,
    date: isoToFR(dto.date),
    heureDebut: dto.startTime,
    heureFin: dto.endTime,
    salle: dto.room,
    visibleEleves: dto.visibleToStudents,
  };
}

/** Calendrier des évaluations — `schedule-service`, `/api/v1/exams`. */
export function createExamsApi(): ExamsPort {
  return {
    async listForClass(classId): Promise<ExamEvent[]> {
      const { schoolId } = sessionContext();
      const [dtos, classes] = await Promise.all([
        request<ExamCalendarResponseDto[]>(`/api/v1/exams/class/${encodeURIComponent(classId)}`, {
          query: { schoolId },
        }),
        fetchSchoolClasses(schoolId),
      ]);
      const classNameById = new Map(classes.map((c) => [c.id, c.fullName]));
      return dtos.map((dto) => fromExamResponse(dto, classNameById));
    },

    async schedule(input): Promise<ExamEvent> {
      const { schoolId, userId } = sessionContext();
      const academicYearId = await resolveYearId();
      const body: ScheduleExamRequestDto = {
        schoolId,
        academicYearId,
        classId: input.classId,
        subjectId: input.subjectId,
        teacherId: userId,
        title: input.titre,
        type: TYPE_TO_API[input.type],
        semesterNumber: input.semestre,
        date: input.date,
        startTime: input.heureDebut,
        endTime: input.heureFin,
        room: input.salle,
        durationMinutes: durationMinutes(input.heureDebut, input.heureFin),
      };
      const dto = await request<ExamCalendarResponseDto>('/api/v1/exams', { method: 'POST', body });
      const classes = await fetchSchoolClasses(schoolId);
      return fromExamResponse(dto, new Map(classes.map((c) => [c.id, c.fullName])));
    },

    async remove(examId): Promise<void> {
      await request<void>(`/api/v1/exams/${encodeURIComponent(examId)}`, { method: 'DELETE' });
    },
  };
}

function durationMinutes(start: string, end: string): number {
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}
