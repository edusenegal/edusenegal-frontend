import { request } from '@/api/client';
import type {
  ExecuteInternalTransferRequestDto,
  InternalTransferExecuteResponseDto,
  InternalTransferPreviewResponseDto,
} from '@/types/api';
import type { TransfersPort } from '@/services/ports';
import type { InternalTransferMapping, InternalTransferPreview, InternalTransferResult } from '@/types/domain';

function fromPreviewResponse(dto: InternalTransferPreviewResponseDto): InternalTransferPreview {
  return {
    studentId: dto.studentId,
    fromClassId: dto.fromClassId,
    toClassId: dto.toClassId,
    matieresCommunes: dto.matchedSubjects.map((s) => ({
      subjectId: s.subjectId,
      subjectNom: s.subjectName,
      coefficientDepart: s.coefficientInFromClass,
      coefficientArrivee: s.coefficientInToClass,
    })),
    matieresOrphelines: dto.orphanSubjects.map((s) => ({
      subjectId: s.subjectId,
      subjectNom: s.subjectName,
      coefficientDepart: s.coefficientInFromClass,
      aDesNotes: s.hasExistingGrades,
    })),
    matieresCandidates: dto.candidateReplacementSubjects.map((s) => ({
      subjectId: s.subjectId,
      subjectNom: s.subjectName,
      coefficientArrivee: s.coefficientInToClass,
    })),
    cheminSansMappingNecessaire: dto.cheapPathEligible,
  };
}

function fromExecuteResponse(dto: InternalTransferExecuteResponseDto): InternalTransferResult {
  return {
    matieresReportees: dto.subjectsCarriedOver,
    matieresExclues: dto.subjectsExcluded,
    matieresCreees: dto.subjectsCreated,
  };
}

/**
 * Portage réel (task #214/#215) — academic-service (`TransferController`).
 * `list`/`requestExternal` restent sur le mock : le transfert externe reste
 * une simple demande de démonstration (aucun backend de suivi inter-écoles
 * à ce jour) — voir le commentaire de `TransfersPort`.
 */
export function createTransfersApi(): Pick<TransfersPort, 'previewInternal' | 'executeInternal'> {
  return {
    async previewInternal(studentId: string, fromClassId: string, toClassId: string): Promise<InternalTransferPreview> {
      const dto = await request<InternalTransferPreviewResponseDto>('/api/v1/academic/transfers/internal/preview', {
        query: { studentId, fromClassId, toClassId },
      });
      return fromPreviewResponse(dto);
    },

    async executeInternal(
      studentId: string,
      fromClassId: string,
      toClassId: string,
      mappings: InternalTransferMapping[],
    ): Promise<InternalTransferResult> {
      const body: ExecuteInternalTransferRequestDto = {
        studentId,
        fromClassId,
        toClassId,
        mappings: mappings.map((m) => ({
          orphanSubjectId: m.matiereOrphelineId,
          replacementSubjectId: m.matiereRemplacementId,
          gradeValue: m.note,
          semesterNumber: m.semestre,
        })),
      };
      const dto = await request<InternalTransferExecuteResponseDto>('/api/v1/academic/transfers/internal/execute', {
        method: 'POST',
        body,
      });
      return fromExecuteResponse(dto);
    },
  };
}
