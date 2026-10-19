import { request, sessionContext } from '@/api/client';
import { fetchSchoolClasses } from '@/api/context';
import type { TimetableSlotResponseDto } from '@/types/api';
import type { TimetablePort } from '@/services/ports';
import type { ScheduleSlotKind, TimetableSlot } from '@/types/domain';

const DAY_LABEL: Record<string, TimetableSlot['jour']> = {
  MON: 'Lundi',
  TUE: 'Mardi',
  WED: 'Mercredi',
  THU: 'Jeudi',
  FRI: 'Vendredi',
  SAT: 'Samedi',
};

function slotKind(dto: TimetableSlotResponseDto): ScheduleSlotKind {
  if (dto.replacementTeacherId) {
    return 'remplacement';
  }
  return dto.subjectId ? 'cours' : 'permanence';
}

function toDomainSlot(dto: TimetableSlotResponseDto, className: string): TimetableSlot {
  return {
    id: dto.id,
    classe: className,
    subjectId: dto.subjectId,
    matiere: dto.subjectName,
    jour: DAY_LABEL[dto.dayOfWeek] ?? 'Lundi',
    heureDebut: dto.startTime,
    heureFin: dto.endTime,
    salle: dto.room,
    kind: slotKind(dto),
    remplacePar: dto.replacementTeacherName ?? null,
    description: dto.description ?? null,
  };
}

/**
 * Emploi du temps du professeur connecté — `GET /timetables/teacher/{teacherId}?schoolId`
 * (schedule-service), toutes classes confondues. Les noms de classe sont
 * résolus côté frontend (le DTO ne porte que `classId`).
 */
export function createTimetableApi(): TimetablePort {
  return {
    async mine(): Promise<TimetableSlot[]> {
      const { schoolId, userId } = sessionContext();
      const [slots, classes] = await Promise.all([
        request<TimetableSlotResponseDto[]>(`/api/v1/timetables/teacher/${encodeURIComponent(userId)}`, {
          query: { schoolId },
        }),
        fetchSchoolClasses(schoolId),
      ]);
      const classNameById = new Map(classes.map((c) => [c.id, c.fullName]));
      return slots.map((dto) => toDomainSlot(dto, classNameById.get(dto.classId) ?? '—'));
    },

    async updateDescription(slotId, description): Promise<TimetableSlot> {
      const dto = await request<TimetableSlotResponseDto>(
        `/api/v1/timetables/slots/${encodeURIComponent(slotId)}/description`,
        { method: 'PATCH', body: { description } },
      );
      const { schoolId } = sessionContext();
      const classes = await fetchSchoolClasses(schoolId);
      const className = classes.find((c) => c.id === dto.classId)?.fullName ?? '—';
      return toDomainSlot(dto, className);
    },
  };
}
