import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import type {
  ApiAssessmentType,
  BulkEnterGradesRequestDto,
  BulkGradeResultDto,
  EnterGradeRequestDto,
  GradeResponseDto,
} from '@/types/api';
import type { GradesPort } from '@/services/ports';
import type { AssessmentType, Grade } from '@/types/domain';

const TYPE_TO_API: Record<AssessmentType, ApiAssessmentType> = {
  devoir1: 'DEVOIR1',
  devoir2: 'DEVOIR2',
  composition: 'COMPOSITION',
  interro: 'INTERRO',
  tp: 'TP',
  td: 'TD',
  devoir: 'DEVOIR',
  controle_continu: 'CONTROLE_CONTINU',
  examen: 'EXAMEN',
  projet: 'PROJET',
  expose: 'EXPOSE',
  stage: 'STAGE',
};
const TYPE_FROM_API: Record<ApiAssessmentType, AssessmentType> = Object.fromEntries(
  Object.entries(TYPE_TO_API).map(([k, v]) => [v, k]),
) as Record<ApiAssessmentType, AssessmentType>;

function fromGradeResponse(dto: GradeResponseDto): Grade {
  return {
    id: dto.id,
    studentId: dto.studentId,
    studentNom: null,
    subjectId: dto.subjectId,
    subjectNom: dto.subjectName,
    semestre: dto.semesterNumber,
    type: TYPE_FROM_API[dto.type] ?? 'devoir',
    session: dto.session === 2 ? 2 : 1,
    valeur: dto.value,
    coefficient: dto.coefficient,
    commentaire: dto.comment,
    verrouillee: dto.locked,
  };
}

/** Saisie et consultation des notes — `academic-service`, `/api/v1/academic/grades`. */
export function createGradesApi(): GradesPort {
  return {
    async listForClass(classId, subjectId, semesterNumber): Promise<Grade[]> {
      const dtos = await request<GradeResponseDto[]>(`/api/v1/academic/grades/class/${encodeURIComponent(classId)}`, {
        query: { subjectId, semesterNumber },
      });
      return dtos.map(fromGradeResponse);
    },

    async enter(input): Promise<Grade> {
      const { schoolId } = sessionContext();
      const academicYearId = await resolveYearId();
      const body: EnterGradeRequestDto = {
        schoolId,
        academicYearId,
        classId: input.classId,
        studentId: input.studentId,
        subjectId: input.subjectId,
        semesterNumber: input.semestre,
        type: TYPE_TO_API[input.type],
        session: input.session,
        value: input.valeur,
        coefficient: input.coefficient,
        comment: input.commentaire,
      };
      const dto = await request<GradeResponseDto>('/api/v1/academic/grades', { method: 'POST', body });
      return fromGradeResponse(dto);
    },

    async enterBulk(input): Promise<{ requested: number; saved: number; updated: number; failed: number }> {
      const { schoolId, userId } = sessionContext();
      const academicYearId = await resolveYearId();
      const body: BulkEnterGradesRequestDto = {
        schoolId,
        academicYearId,
        classId: input.classId,
        subjectId: input.subjectId,
        teacherId: userId,
        semesterNumber: input.semestre,
        type: TYPE_TO_API[input.type],
        session: input.session,
        coefficient: input.coefficient,
        entries: input.entries.map((e) => ({
          studentId: e.studentId,
          value: e.valeur,
          comment: e.commentaire,
          absent: e.absent,
        })),
      };
      const result = await request<BulkGradeResultDto>('/api/v1/academic/grades/bulk', { method: 'POST', body });
      return { requested: result.requested, saved: result.saved, updated: result.updated, failed: result.failed };
    },

    async update(gradeId, valeur, commentaire): Promise<Grade> {
      const dto = await request<GradeResponseDto>(`/api/v1/academic/grades/${encodeURIComponent(gradeId)}`, {
        method: 'PUT',
        query: { value: valeur, comment: commentaire },
      });
      return fromGradeResponse(dto);
    },
  };
}
