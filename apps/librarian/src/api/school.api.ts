import { request, sessionContext } from '@/api/client';
import type { SchoolResponseDto } from '@/types/api';
import type { SchoolPort } from '@/services/ports';
import type { School, SchoolType } from '@/types/domain';

function fromDto(dto: SchoolResponseDto): School {
  const type: SchoolType =
    dto.type === 'PRIMAIRE' || dto.type === 'COLLEGE' || dto.type === 'UNIVERSITE' ? dto.type : 'LYCEE';
  return {
    id: dto.id,
    name: dto.name,
    type,
    region: dto.region ?? '—',
    adresse: dto.address ?? '—',
    telephone: dto.phone ?? '—',
    logoUrl: dto.logoUrl ?? null,
    primaryColor: dto.primaryColor ?? '#1f7a5a',
    secondaryColor: dto.secondaryColor ?? '#0f4c3a',
    devise: 'XOF',
  };
}

export function createSchoolApi(): SchoolPort {
  return {
    async getSchool(): Promise<School> {
      const { schoolId } = sessionContext();
      const dto = await request<SchoolResponseDto>(`/api/v1/schools/${encodeURIComponent(schoolId)}`);
      return fromDto(dto);
    },
  };
}
