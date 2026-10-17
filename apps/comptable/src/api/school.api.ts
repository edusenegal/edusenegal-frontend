import { request, sessionContext } from '@/api/client';
import type { SchoolResponseDto } from '@/types/api';
import type { SchoolPort } from '@/services/ports';
import type { School } from '@/types/domain';

/**
 * Lecture seule — le comptable ne modifie ni le branding ni l'année
 * scolaire (voir `apps/director/src/api/school.api.ts` pour ces écritures).
 * `School.type` (domain) est en réalité l'OWNERSHIP de l'établissement
 * ('public'/'prive', nommage historique trompeur — ne pas confondre avec le
 * type pédagogique LYCEE/COLLEGE/… porté par `SchoolResponseDto.type`/
 * `ApiSchoolType`). Résolu depuis `SchoolResponseDto.ownership` pour que
 * l'écran "Dépenses" puisse bloquer la validation d'une dépense « salaires »
 * pour une école PUBLIQUE, en miroir du garde côté `payment-service`.
 */
function fromSchoolResponse(dto: SchoolResponseDto): School {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.ownership === 'PUBLIC' ? 'public' : 'prive',
    niveau: 'lycee',
    region: dto.region ?? '—',
    adresse: dto.address ?? '—',
    telephone: dto.phone ?? '—',
    email: '—',
    logoUrl: dto.logoUrl ?? null,
    brandColor: dto.primaryColor ?? '#1D9E75',
    devise: 'XOF',
  };
}

export function createSchoolApi(): SchoolPort {
  return {
    async getSchool(): Promise<School> {
      const { schoolId } = sessionContext();
      const dto = await request<SchoolResponseDto>(`/api/v1/schools/${encodeURIComponent(schoolId)}`);
      return fromSchoolResponse(dto);
    },
  };
}
