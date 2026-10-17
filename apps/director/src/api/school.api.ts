import { request, sessionContext } from '@/api/client';
import type { SchoolResponseDto, UpdateSchoolRequestDto } from '@/types/api';
import type { SchoolPort } from '@/services/ports';
import type { School } from '@/types/domain';

/**
 * Portage réel — lecture, couleurs (task #231), logo et coordonnées
 * (nouvelle demande direction — logo/téléphone/e-mail modifiables depuis
 * Paramètres). `School.type` (domain) est en réalité l'OWNERSHIP de
 * l'établissement ('public'/'prive', nommage historique trompeur — ne pas
 * confondre avec le type pédagogique LYCEE/COLLEGE/… porté par
 * `SchoolResponseDto.type`/`ApiSchoolType`). Résolu ici depuis
 * `SchoolResponseDto.ownership` pour que l'écran "Demandes de salaire"
 * puisse bloquer la création côté UI pour une école PUBLIQUE (voir
 * `SalaryRequestsPage`), en miroir du garde ajouté côté `payment-service`.
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
    email: dto.email ?? '—',
    logoUrl: dto.logoUrl ?? null,
    // Valeurs de repli alignées sur `tokens.css` (`--brand-sidebar-bg`/`--brand-primary`
    // par défaut) — task #231 : deux couleurs distinctes au lieu de l'unique `brandColor`.
    primaryColor: dto.primaryColor ?? '#0C241C',
    secondaryColor: dto.secondaryColor ?? '#1D9E75',
    devise: 'XOF',
  };
}

export function createSchoolApi(): Pick<SchoolPort, 'getSchool' | 'updateBranding' | 'uploadLogo' | 'updateContactInfo'> {
  async function getSchool(): Promise<School> {
    const { schoolId } = sessionContext();
    const dto = await request<SchoolResponseDto>(`/api/v1/schools/${encodeURIComponent(schoolId)}`);
    return fromSchoolResponse(dto);
  }

  return {
    getSchool,

    /**
     * Portage réel — `school-service` (`PUT /{schoolId}/colors?primary=&secondary=`,
     * task #231). Les deux couleurs sont des `@RequestParam` obligatoires côté backend :
     * quand l'écran n'en modifie qu'une, l'autre est complétée avec la valeur actuelle
     * (un aller-retour de plus, mais jamais de couleur écrasée par erreur). Le logo
     * (`logoUrl`) n'est pas géré ici — voir `uploadLogo`, qui prend un vrai fichier.
     */
    async updateBranding(patch): Promise<School> {
      const { schoolId } = sessionContext();
      const current = await getSchool();
      const primary = patch.primaryColor ?? current.primaryColor;
      const secondary = patch.secondaryColor ?? current.secondaryColor;
      const dto = await request<SchoolResponseDto>(
        `/api/v1/schools/${encodeURIComponent(schoolId)}/colors`,
        { method: 'PUT', query: { primary, secondary } },
      );
      return fromSchoolResponse(dto);
    },

    /**
     * Portage réel — `PUT /{schoolId}/logo` (multipart, même motif que
     * `SignaturesPort.updateMyAssets` pour le cachet/la signature).
     */
    async uploadLogo(file: File): Promise<School> {
      const { schoolId } = sessionContext();
      const formData = new FormData();
      formData.append('logo', file);
      const dto = await request<SchoolResponseDto>(
        `/api/v1/schools/${encodeURIComponent(schoolId)}/logo`,
        { method: 'PUT', formData },
      );
      return fromSchoolResponse(dto);
    },

    /**
     * Portage réel — `PUT /{schoolId}` (`UpdateSchoolRequest`), mise à jour
     * partielle : un champ omis ici reste inchangé côté backend (voir
     * `SchoolServiceImpl#updateSchool`), donc on n'envoie que téléphone/e-mail
     * sans relire/renvoyer adresse/ville/couleurs/ownership.
     */
    async updateContactInfo(patch): Promise<School> {
      const { schoolId } = sessionContext();
      const body: UpdateSchoolRequestDto = {};
      if (patch.telephone !== undefined) body.phone = patch.telephone;
      if (patch.email !== undefined) body.email = patch.email;
      const dto = await request<SchoolResponseDto>(
        `/api/v1/schools/${encodeURIComponent(schoolId)}`,
        { method: 'PUT', body },
      );
      return fromSchoolResponse(dto);
    },
  };
}
