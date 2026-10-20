import { request, sessionContext } from '@/api/client';
import type {
  ApiPersonalDocumentOwnerType,
  ApiPersonalDocumentType,
  PersonalDocumentResponseDto,
  UploadPersonalDocumentRequestDto,
} from '@/types/api';
import type { PersonalDocumentsPort } from '@/services/ports';
import type { PersonalDocument, PersonalDocumentOwnerType, PersonalDocumentType } from '@/types/domain';
import { isoToFR } from '@/utils/format';

const OWNER_TO_API: Record<PersonalDocumentOwnerType, ApiPersonalDocumentOwnerType> = {
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
const TYPE_FROM_API: Record<ApiPersonalDocumentType, PersonalDocumentType> = Object.fromEntries(
  Object.entries(TYPE_TO_API).map(([k, v]) => [v, k]),
) as Record<ApiPersonalDocumentType, PersonalDocumentType>;

function fromPersonalDocumentResponse(dto: PersonalDocumentResponseDto): PersonalDocument {
  return {
    id: dto.id,
    ownerId: dto.ownerUserId,
    ownerType: dto.ownerType === 'STUDENT' ? 'eleve' : 'personnel',
    type: TYPE_FROM_API[dto.type] ?? 'autre',
    titre: dto.title,
    description: dto.description ?? null,
    fileName: dto.title,
    fileSizeBytes: dto.fileSizeBytes,
    downloadUrl: dto.downloadUrl,
    deposePar: dto.uploadedByUserId,
    // `createdAt` peut manquer (voir le commentaire sur
    // `PersonalDocumentResponseDto.createdAt`) pour un document deja
    // existant avant l'activation de l'audit Mongo -- sans ce garde,
    // `.slice(...)` sur `undefined` plantait TOUTE la liste ("Une erreur
    // est survenue").
    dateDepot: dto.createdAt ? isoToFR(dto.createdAt.slice(0, 10)) : '—',
  };
}

/** Pièces personnelles de l'enseignant connecté — `document-service`, `/api/v1/personal-documents`. */
export function createPersonalDocumentsApi(): PersonalDocumentsPort {
  return {
    async list(ownerId): Promise<PersonalDocument[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<PersonalDocumentResponseDto[]>(
        `/api/v1/personal-documents/owner/${encodeURIComponent(ownerId)}`,
        { query: { schoolId } },
      );
      return dtos.map(fromPersonalDocumentResponse);
    },

    async upload(input): Promise<PersonalDocument> {
      const { schoolId } = sessionContext();
      const data: UploadPersonalDocumentRequestDto = {
        schoolId,
        ownerUserId: input.ownerId,
        ownerType: OWNER_TO_API[input.ownerType],
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
      return fromPersonalDocumentResponse(dto);
    },

    async remove(documentId): Promise<void> {
      await request<void>(`/api/v1/personal-documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
    },
  };
}
