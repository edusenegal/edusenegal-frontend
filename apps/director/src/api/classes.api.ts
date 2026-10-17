import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import { AppError } from '@/services/errors';
import type {
  ApiDayOfWeek,
  ApiExamType,
  ClassInfoDto,
  ClassResponseDto,
  CreateClassRequestDto,
  CreateTimetableRequestDto,
  ExamCalendarResponseDto,
  ScheduleExamRequestDto,
  TimetableSlotEntryDto,
  TimetableVersionResponseDto,
} from '@/types/api';
import type { ClassesPort } from '@/services/ports';
import type { ClassEvent, ClassGroup, ClassLevel, EventType, ScheduleSlot } from '@/types/domain';

/**
 * `GET /classes/{id}` et `GET /classes/school/.../year/...` renvoient
 * `ClassInfoDto` (teacherIds mêle professeur principal + itinérants) ;
 * `POST /classes` et les deux routes homeroom-teacher renvoient
 * `ClassResponseDto` (itinerantTeacherIds séparé). Deux mappings distincts,
 * fidèles à ce que chaque route rend réellement.
 */
function fromClassInfo(dto: ClassInfoDto): ClassGroup {
  return {
    id: dto.id,
    level: dto.level as ClassLevel,
    series: dto.series,
    tag: dto.tag,
    name: dto.fullName,
    effectif: dto.studentIds.length,
    capacite: dto.capacity,
    homeroomTeacherId: dto.homeroomTeacherId,
    itinerantTeacherIds: dto.teacherIds.filter((id) => id !== dto.homeroomTeacherId),
    defaultRoomId: dto.defaultRoomId ?? null,
  };
}

function fromClassResponse(dto: ClassResponseDto): ClassGroup {
  return {
    id: dto.id,
    level: dto.level as ClassLevel,
    series: dto.series,
    tag: dto.tag,
    name: dto.fullName,
    effectif: dto.studentCount,
    capacite: dto.capacity,
    homeroomTeacherId: dto.homeroomTeacherId,
    itinerantTeacherIds: dto.itinerantTeacherIds,
    defaultRoomId: dto.defaultRoomId ?? null,
  };
}

// ── Calendrier (devoirs/examens/compositions/conseils de classe) ──

/**
 * Le frontend n'offre que 4 types (voir `EventType`) ; le backend en
 * distingue 6. Mapping volontairement simplifié — signalé à la direction :
 * `DEVOIR2` et `INTERRO` restent inatteignables depuis cet écran faute
 * d'un type frontend dédié.
 */
const EVENT_TYPE_TO_API: Record<EventType, ApiExamType> = {
  Devoir: 'DEVOIR1',
  Examen: 'EXAMEN_BLANC',
  Composition: 'COMPOSITION',
  'Conseil de classe': 'CONSEIL_DE_CLASSE',
};
const API_TYPE_TO_EVENT: Record<ApiExamType, EventType> = {
  DEVOIR1: 'Devoir',
  DEVOIR2: 'Devoir',
  COMPOSITION: 'Composition',
  INTERRO: 'Devoir',
  EXAMEN_BLANC: 'Examen',
  CONSEIL_DE_CLASSE: 'Conseil de classe',
};

/** `dd/mm/yyyy` (convention frontend) ⇄ `yyyy-MM-dd` (ISO, attendu par schedule-service). */
function frDateToIso(fr: string): string {
  const [d, m, y] = fr.split('/');
  return `${y}-${m}-${d}`;
}
function isoDateToFr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function durationMinutes(start: string, end: string): number {
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function fromExamResponse(dto: ExamCalendarResponseDto): ClassEvent {
  return {
    id: dto.id,
    classeId: dto.classId,
    type: API_TYPE_TO_EVENT[dto.type],
    titre: dto.title,
    subjectId: dto.subjectId,
    matiere: dto.subjectName,
    teacherId: dto.teacherId,
    professeur: dto.teacherName,
    semestre: (dto.semesterNumber === 2 ? 2 : 1) as 1 | 2,
    date: isoDateToFr(dto.date),
    heureDebut: dto.startTime,
    heureFin: dto.endTime,
    salle: dto.room,
    notes: '',
  };
}

// ── Emploi du temps hebdomadaire (versionné) ──

const DAY_TO_API: Record<ScheduleSlot['jour'], ApiDayOfWeek> = {
  Lundi: 'MON',
  Mardi: 'TUE',
  Mercredi: 'WED',
  Jeudi: 'THU',
  Vendredi: 'FRI',
  Samedi: 'SAT',
};
const API_TO_DAY: Record<ApiDayOfWeek, ScheduleSlot['jour']> = {
  MON: 'Lundi',
  TUE: 'Mardi',
  WED: 'Mercredi',
  THU: 'Jeudi',
  FRI: 'Vendredi',
  SAT: 'Samedi',
};

function fromTimetableVersion(version: TimetableVersionResponseDto): ScheduleSlot[] {
  return version.slots.map((slot) => ({
    jour: API_TO_DAY[slot.dayOfWeek],
    heureDebut: slot.startTime,
    heureFin: slot.endTime,
    subjectId: slot.subjectId,
    matiere: slot.subjectName,
    enseignantId: slot.teacherId,
    professeur: slot.teacherName,
    salle: slot.room,
    kind: 'cours',
  }));
}

/** Reconstruit la liste COMPLÈTE de créneaux à envoyer à `createTimetable` (voir son commentaire côté DTO). */
function toSlotEntries(slots: ScheduleSlot[]): TimetableSlotEntryDto[] {
  return slots
    .filter((s) => s.kind === 'cours' && s.subjectId && s.enseignantId)
    .map((s) => ({
      subjectId: s.subjectId!,
      teacherId: s.enseignantId!,
      dayOfWeek: DAY_TO_API[s.jour],
      startTime: s.heureDebut,
      endTime: s.heureFin,
      room: s.salle,
      weekNumber: 0,
    }));
}

async function replaceTimetable(classId: string, slots: ScheduleSlot[]): Promise<ScheduleSlot[]> {
  const { schoolId } = sessionContext();
  const yearId = await resolveYearId();
  const body: CreateTimetableRequestDto = {
    schoolId,
    academicYearId: yearId,
    classId,
    type: 'WEEKLY',
    semesterNumber: 0,
    trimesterNumber: 0,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    slots: toSlotEntries(slots),
  };
  const version = await request<TimetableVersionResponseDto>('/api/v1/timetables', { method: 'POST', body });
  return fromTimetableVersion(version);
}

async function fetchActiveSlots(classId: string): Promise<ScheduleSlot[]> {
  try {
    const version = await request<TimetableVersionResponseDto>(
      `/api/v1/timetables/class/${encodeURIComponent(classId)}/active`,
    );
    return fromTimetableVersion(version);
  } catch (e) {
    // Aucune version active encore créée pour cette classe — grille vide,
    // pas une erreur à afficher.
    if (e instanceof AppError && e.kind === 'notFound') return [];
    throw e;
  }
}

/**
 * Portage réel — `class-service` (`ClassController`) + `schedule-service`
 * (`ExamController`/`TimetableController`). Tous les ports sont désormais
 * branchés : plus de délégation à `createMockServices()` pour cette classe.
 */
export function createClassesApi(): ClassesPort {
  return {
    async list(): Promise<ClassGroup[]> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      const dtos = await request<ClassInfoDto[]>(
        `/api/v1/classes/school/${encodeURIComponent(schoolId)}/year/${encodeURIComponent(yearId)}`,
      );
      return dtos.map(fromClassInfo);
    },

    async get(classId: string): Promise<ClassGroup> {
      const dto = await request<ClassInfoDto>(`/api/v1/classes/${encodeURIComponent(classId)}`);
      return fromClassInfo(dto);
    },

    async create(input): Promise<ClassGroup> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      const body: CreateClassRequestDto = {
        schoolId,
        academicYearId: yearId,
        schoolType: 'LYCEE',
        level: input.level,
        series: input.series,
        tag: input.tag,
        capacity: input.capacite,
        ...(input.homeroomTeacherId ? { homeroomTeacherId: input.homeroomTeacherId } : {}),
      };
      const dto = await request<ClassResponseDto>('/api/v1/classes', { method: 'POST', body });
      return fromClassResponse(dto);
    },

    async setHomeroomTeacher(classId: string, teacherId: string | null): Promise<ClassGroup> {
      const dto =
        teacherId === null
          ? await request<ClassResponseDto>(`/api/v1/classes/${encodeURIComponent(classId)}/homeroom-teacher`, {
              method: 'DELETE',
            })
          : await request<ClassResponseDto>(
              `/api/v1/classes/${encodeURIComponent(classId)}/homeroom-teacher/${encodeURIComponent(teacherId)}`,
              { method: 'PUT' },
            );
      return fromClassResponse(dto);
    },

    /** Salle de classe par défaut (task #229) — `roomId` n'est pas validé ici (cross-service, voir le commentaire de `ClassController.assignRoom`). */
    async setDefaultRoom(classId: string, roomId: string | null): Promise<ClassGroup> {
      const dto =
        roomId === null
          ? await request<ClassResponseDto>(`/api/v1/classes/${encodeURIComponent(classId)}/room`, {
              method: 'DELETE',
            })
          : await request<ClassResponseDto>(
              `/api/v1/classes/${encodeURIComponent(classId)}/room/${encodeURIComponent(roomId)}`,
              { method: 'PUT' },
            );
      return fromClassResponse(dto);
    },

    async listEvents(classId: string): Promise<ClassEvent[]> {
      const dtos = await request<ExamCalendarResponseDto[]>(`/api/v1/exams/class/${encodeURIComponent(classId)}`);
      return dtos.map(fromExamResponse).sort((a, b) => frDateToIso(a.date).localeCompare(frDateToIso(b.date)));
    },

    async planEvent(input): Promise<ClassEvent> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      if (!input.subjectId && input.type !== 'Conseil de classe') {
        throw new AppError('validation', 'Choisissez une matière pour cette échéance.', 422);
      }
      if (!input.teacherId) {
        throw new AppError('validation', 'Choisissez le professeur responsable de cette échéance.', 422);
      }
      const body: ScheduleExamRequestDto = {
        schoolId,
        academicYearId: yearId,
        classId: input.classeId,
        subjectId: input.subjectId ?? '',
        teacherId: input.teacherId,
        title: input.titre,
        type: EVENT_TYPE_TO_API[input.type],
        semesterNumber: input.semestre,
        date: frDateToIso(input.date),
        startTime: input.heureDebut,
        endTime: input.heureFin,
        room: input.salle,
        durationMinutes: durationMinutes(input.heureDebut, input.heureFin),
      };
      const dto = await request<ExamCalendarResponseDto>('/api/v1/exams', { method: 'POST', body });
      return fromExamResponse(dto);
    },

    async cancelEvent(eventId: string): Promise<void> {
      await request<void>(`/api/v1/exams/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
    },

    async getWeeklySchedule(classId: string): Promise<ScheduleSlot[]> {
      return fetchActiveSlots(classId);
    },

    async addScheduleSlot(classId: string, slot: ScheduleSlot): Promise<ScheduleSlot[]> {
      const current = await fetchActiveSlots(classId);
      return replaceTimetable(classId, [...current, slot]);
    },

    async removeScheduleSlot(classId: string, slot: Pick<ScheduleSlot, 'jour' | 'heureDebut'>): Promise<ScheduleSlot[]> {
      const current = await fetchActiveSlots(classId);
      const remaining = current.filter((s) => !(s.jour === slot.jour && s.heureDebut === slot.heureDebut));
      return replaceTimetable(classId, remaining);
    },

    async updateScheduleSlot(
      classId: string,
      oldKey: Pick<ScheduleSlot, 'jour' | 'heureDebut'>,
      slot: ScheduleSlot,
    ): Promise<ScheduleSlot[]> {
      const current = await fetchActiveSlots(classId);
      const remaining = current.filter((s) => !(s.jour === oldKey.jour && s.heureDebut === oldKey.heureDebut));
      return replaceTimetable(classId, [...remaining, slot]);
    },

    async enroll(classId: string, studentId: string): Promise<void> {
      await request<ClassResponseDto>(
        `/api/v1/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
        { method: 'POST' },
      );
    },

    async unenroll(classId: string, studentId: string): Promise<void> {
      await request<ClassResponseDto>(
        `/api/v1/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
        { method: 'DELETE' },
      );
    },
  };
}
