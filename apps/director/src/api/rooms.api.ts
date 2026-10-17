import { request, sessionContext } from '@/api/client';
import type {
  ApiDayOfWeek,
  ClassRoomDto,
  CreateClassRoomRequestDto,
  RoomAvailabilityResponseDto,
  UpdateClassRoomRequestDto,
} from '@/types/api';
import type { RoomsPort } from '@/services/ports';
import type { ClassRoom, RoomAvailability, ScheduleSlot } from '@/types/domain';

const DAY_TO_API: Record<ScheduleSlot['jour'], ApiDayOfWeek> = {
  Lundi: 'MON',
  Mardi: 'TUE',
  Mercredi: 'WED',
  Jeudi: 'THU',
  Vendredi: 'FRI',
  Samedi: 'SAT',
};

function fromRoomDto(dto: ClassRoomDto): ClassRoom {
  return { id: dto.id, nom: dto.name, capacite: dto.capacity, classeId: dto.classId ?? undefined };
}

function fromAvailabilityDto(dto: RoomAvailabilityResponseDto): RoomAvailability {
  return {
    salleId: dto.roomId,
    salleNom: dto.roomName,
    capacite: dto.capacity,
    disponible: dto.available,
    raisonConflit: dto.conflictReason,
  };
}

/**
 * Portage réel (task #217) — schedule-service (\`ClassRoomController\`).
 * Catalogue de salles par école, sélectionnable lors de la création d'un
 * créneau d'emploi du temps ou d'un examen, avec vérification de
 * disponibilité (voir le commentaire de \`RoomsPort\`).
 */
export function createRoomsApi(): RoomsPort {
  return {
    async list(): Promise<ClassRoom[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<ClassRoomDto[]>(`/api/v1/rooms/school/${encodeURIComponent(schoolId)}`);
      return dtos.map(fromRoomDto);
    },

    async create(input): Promise<ClassRoom> {
      const { schoolId } = sessionContext();
      const body: CreateClassRoomRequestDto = {
        schoolId,
        name: input.nom,
        capacity: input.capacite,
        classId: input.classeId || undefined,
      };
      const dto = await request<ClassRoomDto>('/api/v1/rooms', { method: 'POST', body });
      return fromRoomDto(dto);
    },

    async update(roomId: string, input): Promise<ClassRoom> {
      const body: UpdateClassRoomRequestDto = { name: input.nom, capacity: input.capacite };
      const dto = await request<ClassRoomDto>(`/api/v1/rooms/${encodeURIComponent(roomId)}`, { method: 'PUT', body });
      return fromRoomDto(dto);
    },

    async remove(roomId: string): Promise<void> {
      await request<void>(`/api/v1/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE' });
    },

    async checkAvailability(input): Promise<RoomAvailability[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<RoomAvailabilityResponseDto[]>('/api/v1/rooms/availability', {
        query: {
          schoolId,
          dayOfWeek: input.jour ? DAY_TO_API[input.jour] : undefined,
          date: input.date,
          startTime: input.heureDebut,
          endTime: input.heureFin,
          excludeSlotId: input.excludeSlotId,
          excludeExamId: input.excludeExamId,
        },
      });
      return dtos.map(fromAvailabilityDto);
    },
  };
}
