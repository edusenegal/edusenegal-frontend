import { request, sessionContext } from '@/api/client';
import type {
  ExecuteInternalTransferRequestDto,
  InternalTransferExecuteResponseDto,
  InternalTransferPreviewResponseDto,
} from '@/types/api';
import type { TransfersPort } from '@/services/ports';
import type { InterSchoolTransfer, SchoolRef, StudentLookup, TransferDossierJob } from '@/types/domain';
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
type PortedTransfers = Pick<
  TransfersPort,
  | 'previewInternal'
  | 'executeInternal'
  | 'lookupStudent'
  | 'resolveSchoolByIndicatif'
  | 'createOutgoingTransfer'
  | 'createIncomingTransfer'
  | 'authorizeTransfer'
  | 'acceptTransfer'
  | 'refuseTransfer'
  | 'cancelTransfer'
  | 'getInterSchoolTransfer'
  | 'listOutgoingTransfers'
  | 'listIncomingTransfers'
  | 'startDossier'
  | 'getDossierJob'
>;

const TBASE = '/api/v1/users/transfers';

export function createTransfersApi(): PortedTransfers {
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

    // ── Transfert inter-écoles (flux de consentement A + B) ──
    async lookupStudent(matricule: string): Promise<StudentLookup> {
      return request<StudentLookup>(`${TBASE}/lookup`, { query: { matricule } });
    },

    async resolveSchoolByIndicatif(indicatif: string): Promise<SchoolRef> {
      const dto = await request<{ id: string; name?: string; indicatif?: string }>(
        `/api/v1/schools/by-indicatif/${encodeURIComponent(indicatif)}`,
      );
      return { id: dto.id, name: dto.name ?? null, indicatif: dto.indicatif ?? null };
    },

    async createOutgoingTransfer(input): Promise<InterSchoolTransfer> {
      const { schoolId } = sessionContext();
      return request<InterSchoolTransfer>(`${TBASE}/outgoing`, {
        method: 'POST',
        body: { ...input, fromSchoolId: schoolId },
      });
    },

    async createIncomingTransfer(input): Promise<InterSchoolTransfer> {
      const { schoolId } = sessionContext();
      return request<InterSchoolTransfer>(`${TBASE}/incoming`, {
        method: 'POST',
        body: { ...input, toSchoolId: schoolId },
      });
    },

    async authorizeTransfer(id: string): Promise<InterSchoolTransfer> {
      return request<InterSchoolTransfer>(`${TBASE}/${encodeURIComponent(id)}/authorize`, { method: 'PATCH' });
    },

    async acceptTransfer(id, input): Promise<InterSchoolTransfer> {
      return request<InterSchoolTransfer>(`${TBASE}/${encodeURIComponent(id)}/accept`, { method: 'PATCH', body: input });
    },

    async refuseTransfer(id: string): Promise<InterSchoolTransfer> {
      return request<InterSchoolTransfer>(`${TBASE}/${encodeURIComponent(id)}/refuse`, { method: 'PATCH' });
    },

    async cancelTransfer(id: string): Promise<InterSchoolTransfer> {
      return request<InterSchoolTransfer>(`${TBASE}/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' });
    },

    async getInterSchoolTransfer(id: string): Promise<InterSchoolTransfer> {
      return request<InterSchoolTransfer>(`${TBASE}/${encodeURIComponent(id)}`);
    },

    async listOutgoingTransfers(): Promise<InterSchoolTransfer[]> {
      const { schoolId } = sessionContext();
      return request<InterSchoolTransfer[]>(`${TBASE}/outgoing`, { query: { schoolId } });
    },

    async listIncomingTransfers(): Promise<InterSchoolTransfer[]> {
      const { schoolId } = sessionContext();
      return request<InterSchoolTransfer[]>(`${TBASE}/incoming`, { query: { schoolId } });
    },

    async startDossier(id: string): Promise<TransferDossierJob> {
      return request<TransferDossierJob>(`${TBASE}/${encodeURIComponent(id)}/dossier`, { method: 'POST' });
    },

    async getDossierJob(jobId: string): Promise<TransferDossierJob> {
      return request<TransferDossierJob>(`${TBASE}/dossier/jobs/${encodeURIComponent(jobId)}`);
    },
  };
}
