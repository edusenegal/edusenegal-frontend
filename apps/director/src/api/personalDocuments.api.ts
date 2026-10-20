import { request, sessionContext } from '@/api/client';
import type {
  ApiPersonalDocumentOwnerType,
  ApiPersonalDocumentType,
  PersonalDocumentResponseDto,
  UploadPersonalDocumentRequestDto,
} from '@/types/api';
import type { PersonalDocumentsPort } from '@/services/ports';
import type { PersonalDocument, PersonalDocumentOwnerType, PersonalDocumentType } from '@/types/domain';
import { frToISO, isoToFR } from '@/utils/format';

const OWNER_TYPE_TO_API: Record<PersonalDocumentOwnerType, ApiPersonalDocumentOwnerType> = {
  personnel: 'STAFF',
  eleve: 'STUDENT',
};

const TYPE_TO_API: Record<PersonalDocumentType, ApiPersonalDocumentType> = {
  cni: 'CNI',
  diplome: 'DIPLOMA',
  certification: 'CERTIFICATION',
  acte_naissance: 'BIRTH_CERTIFICATE',
  cni_parent: 'PARENT_CNI',
  autre: 'OTHER',
};

const TYPE_FROM_API: Record<ApiPersonalDocumentType, PersonalDocumentType> = {
  CNI: 'cni',
  DIPLOMA: 'diplome',
  CERTIFICATION: 'certification',
  BIRTH_CERTIFICATE: 'acte_naissance',
  PARENT_CNI: 'cni_parent',
  OTHER: 'autre',
};

const OWNER_TYPE_FROM_API: Record<ApiPersonalDocumentOwnerType, PersonalDocumentOwnerType> = {
  STAFF: 'personnel',
  STUDENT: 'eleve',
};

function fromDto(dto: PersonalDocumentResponseDto): PersonalDocument {
  const fileName = dto.fileType ? `${dto.title}.${dto.fileType}` : dto.title;
  return {
    id: dto.id,
    ownerId: dto.ownerUserId,
    ownerType: OWNER_TYPE_FROM_API[dto.ownerType],
    type: TYPE_FROM_API[dto.type],
    titre: dto.title,
    description: dto.description ?? null,
    fileName,
    fileSizeBytes: dto.fileSizeBytes,
    downloadUrl: dto.downloadUrl,
    // Jamais affiché aujourd'hui (voir `PersonalDocumentsSection`) -- l'id brut
    // suffit à garder l'info traçable sans appel supplémentaire à user-service
    // pour résoudre un nom d'affichage.
    deposePar: dto.uploadedByUserId,
    dateDepot: isoToFR(dto.createdAt.slice(0, 10)),
  };
}

/**
 * Portage réel — `document-service`, `PersonalDocumentController`
 * (`/api/v1/personal-documents`). Jusqu'ici ce port ne délèguait qu'au mock
 * (voir le commentaire de `createApiServices`) : un document ajouté depuis
 * la fiche enseignant/élève n'était donc jamais écrit en base et ne
 * pouvait apparaître nulle part ailleurs (ex. l'onglet Documents de
 * l'application mobile élève).
 *
 * `listForOwner` ne prend pas `ownerType` côté serveur (l'id du
 * propriétaire suffit, il n'appartient qu'à un seul profil) ; `ownerType`
 * ne sert ici que côté client, pour appliquer la même règle de validation
 * type/propriétaire que `PersonalDocumentServiceImpl.validateTypeForOwner`
 * avant même l'envoi.
 */
export function createPersonalDocumentsApi(): PersonalDocumentsPort {
  return {
    async list(ownerId): Promise<PersonalDocument[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<PersonalDocumentResponseDto[]>(
        `/api/v1/personal-documents/owner/${encodeURIComponent(ownerId)}`,
        { query: { schoolId } },
      );
      // Même tri que le mock (`createMockServices().personalDocuments.list`) :
      // le plus récent d'abord.
      return dtos.map(fromDto).sort((a, b) => frToISO(b.dateDepot).localeCompare(frToISO(a.dateDepot)));
    },

    async upload(input): Promise<PersonalDocument> {
      const { schoolId } = sessionContext();
      const data: UploadPersonalDocumentRequestDto = {
        schoolId,
        ownerUserId: input.ownerId,
        ownerType: OWNER_TYPE_TO_API[input.ownerType],
        type: TYPE_TO_API[input.type],
        title: input.titre,
        description: input.description,
      };
      const formData = new FormData();
      formData.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
      formData.append('file', input.file);
      const dto = await request<PersonalDocumentResponseDto>('/api/v1/personal-documents', {
        method: 'POST',
        formData,
      });
      return fromDto(dto);
    },

    async remove(documentId): Promise<void> {
      await request<void>(`/api/v1/personal-documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
    },
  };
}
