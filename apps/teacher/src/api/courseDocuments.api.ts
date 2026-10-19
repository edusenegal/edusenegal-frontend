import { request } from '@/api/client';
import type { ApiCourseDocumentType, DocumentResponseDto, UploadDocumentRequestDto } from '@/types/api';
import type { CourseDocumentsPort } from '@/services/ports';
import type { CourseDocument, CourseDocumentType } from '@/types/domain';
import { isoToFR } from '@/utils/format';

const TYPE_TO_API: Record<CourseDocumentType, ApiCourseDocumentType> = {
  cours: 'COURSE',
  exercice: 'EXERCISE',
  corrige: 'CORRECTION',
  sujet_examen: 'EXAM_SUBJECT',
  ressource: 'RESOURCE',
  autre: 'OTHER',
};
const TYPE_FROM_API: Record<ApiCourseDocumentType, CourseDocumentType> = Object.fromEntries(
  Object.entries(TYPE_TO_API).map(([k, v]) => [v, k]),
) as Record<ApiCourseDocumentType, CourseDocumentType>;

function fromDocumentResponse(dto: DocumentResponseDto): CourseDocument {
  return {
    id: dto.id,
    subjectId: dto.subjectId,
    timetableSlotId: dto.timetableSlotId ?? null,
    type: TYPE_FROM_API[dto.type] ?? 'autre',
    titre: dto.title,
    description: dto.description,
    fileName: dto.title,
    fileSizeBytes: dto.fileSizeBytes,
    downloadUrl: dto.downloadUrl,
    deposePar: dto.uploadedByTeacherId,
    dateDepot: isoToFR(dto.createdAt.slice(0, 10)),
  };
}

/** Documents pédagogiques d'une matière — `document-service`, `/api/v1/documents`. */
export function createCourseDocumentsApi(): CourseDocumentsPort {
  return {
    async list(subjectId): Promise<CourseDocument[]> {
      const dtos = await request<DocumentResponseDto[]>(`/api/v1/documents/subject/${encodeURIComponent(subjectId)}`);
      return dtos.map(fromDocumentResponse);
    },

    async listForSlot(timetableSlotId): Promise<CourseDocument[]> {
      const dtos = await request<DocumentResponseDto[]>(`/api/v1/documents/slot/${encodeURIComponent(timetableSlotId)}`);
      return dtos.map(fromDocumentResponse);
    },

    async upload(input): Promise<CourseDocument> {
      const data: UploadDocumentRequestDto = {
        classId: input.classId,
        subjectId: input.subjectId,
        timetableSlotId: input.timetableSlotId,
        type: TYPE_TO_API[input.type],
        title: input.titre,
        description: input.description,
      };
      const formData = new FormData();
      formData.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
      formData.append('file', input.file);
      const dto = await request<DocumentResponseDto>('/api/v1/documents', { method: 'POST', formData });
      return fromDocumentResponse(dto);
    },

    async remove(documentId): Promise<void> {
      await request<void>(`/api/v1/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
    },
  };
}
