import { request, sessionContext } from '@/api/client';
import type { SchoolResponseDto } from '@/types/api';
import type { SchoolPort } from '@/services/ports';
import type { School } from '@/types/domain';

function fromSchoolResponse(dto: SchoolResponseDto): School {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.ownership === 'PUBLIC' ? 'public' : 'prive',
    region: dto.region ?? '—',
    adresse: dto.address ?? '—',
    telephone: dto.phone ?? '—',
    logoUrl: dto.logoUrl ?? null,
    primaryColor: dto.primaryColor ?? '#0C241C',
    secondaryColor: dto.secondaryColor ?? '#1D9E75',
    devise: 'XOF',
  };
}

/** Lecture seule — voir le commentaire de `SchoolPort`. */
export function createSchoolApi(): SchoolPort {
  return {
    async getSchool(): Promise<School> {
      const { schoolId } = sessionContext();
      const dto = await request<SchoolResponseDto>(`/api/v1/schools/${encodeURIComponent(schoolId)}`);
      return fromSchoolResponse(dto);
    },

    async getSchoolById(schoolId: string): Promise<School> {
      const dto = await request<SchoolResponseDto>(`/api/v1/schools/${encodeURIComponent(schoolId)}`);
      return fromSchoolResponse(dto);
    },
  };
}
