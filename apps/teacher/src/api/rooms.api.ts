import { request, sessionContext } from '@/api/client';
import type { ClassRoomDto, RoomAvailabilityResponseDto } from '@/types/api';
import type { RoomsPort } from '@/services/ports';
import type { ClassRoom, RoomAvailability } from '@/types/domain';

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
 * Catalogue de salles — `schedule-service` (`ClassRoomController`). Lecture
 * seule côté professeur (la gestion du catalogue reste un acte de direction) :
 * utilisé pour choisir une salle disponible en planifiant un devoir/examen.
 */
export function createRoomsApi(): RoomsPort {
  return {
    async list(): Promise<ClassRoom[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<ClassRoomDto[]>(`/api/v1/rooms/school/${encodeURIComponent(schoolId)}`);
      return dtos.map(fromRoomDto);
    },

    async checkAvailability(input): Promise<RoomAvailability[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<RoomAvailabilityResponseDto[]>('/api/v1/rooms/availability', {
        query: {
          schoolId,
          date: input.date,
          startTime: input.heureDebut,
          endTime: input.heureFin,
          excludeExamId: input.excludeExamId,
        },
      });
      return dtos.map(fromAvailabilityDto);
    },
  };
}
