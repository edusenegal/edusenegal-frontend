import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import { AppError, toAppError } from '@/services/errors';
import type { SemesterResultResponseDto, UserResponseDto } from '@/types/api';
import type { ResultsPort } from '@/services/ports';
import type { Mention, SemesterResult, SubjectAverage } from '@/types/domain';
import { buildDownloadFilename, downloadBlob } from '@/utils/format';

const MENTION_FROM_API: Record<string, Mention> = {
  EXCELLENT: 'excellent',
  TRES_BIEN: 'tres_bien',
  BIEN: 'bien',
  ASSEZ_BIEN: 'assez_bien',
  PASSABLE: 'passable',
  INSUFFISANT: 'insuffisant',
};

function fromSemesterResultResponse(dto: SemesterResultResponseDto): SemesterResult {
  const matieres: SubjectAverage[] = dto.subjects.map((s) => ({
    subjectId: s.subjectId,
    subjectNom: s.subjectName,
    moyenne: s.average,
    coefficient: s.coefficient,
    mention: MENTION_FROM_API[s.mention] ?? 'passable',
  }));
  return {
    id: dto.id,
    studentId: dto.studentId,
    studentNom: '',
    classId: dto.classId,
    semestre: dto.semesterNumber,
    moyenneGenerale: dto.generalAverage,
    rangClasse: dto.rankInClass,
    totalEleves: dto.totalStudents,
    mention: MENTION_FROM_API[dto.mention] ?? 'passable',
    matieres,
    bulletinGenere: dto.bulletinGenerated,
    publie: dto.published,
  };
}

/**
 * Résultats semestriels — lecture seule côté enseignant (le calcul/la
 * publication sont des actes de direction, voir `apps/director`). Backend :
 * `academic-service`, `/api/v1/academic/results`, `/api/v1/academic/bulletins`.
 */
export function createResultsApi(): ResultsPort {
  return {
    async getStudentSemesterResult(studentId, semesterNumber): Promise<SemesterResult | null> {
      const yearId = await resolveYearId();
      try {
        const dto = await request<SemesterResultResponseDto>(
          `/api/v1/academic/results/student/${encodeURIComponent(studentId)}/semester/${semesterNumber}`,
          { query: { yearId } },
        );
        return fromSemesterResultResponse(dto);
      } catch (error) {
        // `RESULT_NOT_AVAILABLE` (404) : moyennes pas encore calculées — un
        // état normal en début de semestre, pas une erreur à afficher.
        const appError = toAppError(error);
        if (appError.kind === 'notFound') {
          return null;
        }
        throw appError instanceof AppError ? appError : error;
      }
    },

    async downloadBulletinPdf(studentId, semesterNumber): Promise<void> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      const [blob, student] = await Promise.all([
        request<Blob>(
          `/api/v1/academic/bulletins/student/${encodeURIComponent(studentId)}/semester/${semesterNumber}/pdf`,
          { query: { schoolId, yearId }, responseType: 'blob' },
        ),
        request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(studentId)}`),
      ]);
      downloadBlob(blob, buildDownloadFilename('bulletin', student.firstName, student.lastName, { semesterNumber }));
    },
  };
}
