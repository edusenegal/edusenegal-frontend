import { request, sessionContext } from '@/api/client';
import { resolveYearId } from '@/api/context';
import { AppError } from '@/services/errors';
import { buildDownloadFilename, downloadBlob, frToISO, isoToFR } from '@/utils/format';
import type {
  AcademicYearConfigResponseDto,
  ApiMention,
  ApiPeriodType,
  ApiPromotionResult,
  CloseYearRequestDto,
  ConfigureAcademicYearRequestDto,
  SemesterPeriodDto,
  SemesterResultResponseDto,
  SubjectAverageDto,
  UserResponseDto,
  YearResultResponseDto,
} from '@/types/api';
import type { AcademicResultsPort } from '@/services/ports';
import type {
  AcademicPeriod,
  AcademicPeriodType,
  AcademicYearConfig,
  Mention,
  PromotionResult,
  SemesterResult,
  SubjectAverage,
  YearResult,
} from '@/types/domain';

const PERIOD_TYPE_TO_API: Record<AcademicPeriodType, ApiPeriodType> = {
  semestre: 'SEMESTER',
  trimestre: 'TRIMESTER',
  annuel: 'ANNUAL',
};
const API_TO_PERIOD_TYPE: Record<ApiPeriodType, AcademicPeriodType> = {
  SEMESTER: 'semestre',
  TRIMESTER: 'trimestre',
  ANNUAL: 'annuel',
};

const MENTION_TO_DOMAIN: Record<ApiMention, Mention> = {
  EXCELLENT: 'excellent',
  TRES_BIEN: 'tres_bien',
  BIEN: 'bien',
  ASSEZ_BIEN: 'assez_bien',
  PASSABLE: 'passable',
  INSUFFISANT: 'insuffisant',
};

const PROMOTION_TO_DOMAIN: Record<ApiPromotionResult, PromotionResult> = {
  PROMOTED: 'admis',
  EXCEPTIONAL: 'admis_exceptionnel',
  RETAINED: 'redouble',
  EXCLUDED: 'exclu',
};
const DOMAIN_TO_PROMOTION: Record<PromotionResult, ApiPromotionResult> = {
  admis: 'PROMOTED',
  admis_exceptionnel: 'EXCEPTIONAL',
  redouble: 'RETAINED',
  exclu: 'EXCLUDED',
};

function fromApiPeriod(dto: SemesterPeriodDto): AcademicPeriod {
  return {
    number: dto.number,
    label: dto.label,
    dateDebut: isoToFR(dto.startDate),
    dateFin: isoToFR(dto.endDate),
    dateLimiteNotes: isoToFR(dto.gradeDeadline),
    dateBulletin: isoToFR(dto.bulletinDate),
    verrouillee: dto.locked,
  };
}

function toApiPeriod(period: Omit<AcademicPeriod, 'verrouillee'>): SemesterPeriodDto {
  return {
    number: period.number,
    label: period.label,
    startDate: frToISO(period.dateDebut),
    endDate: frToISO(period.dateFin),
    gradeDeadline: frToISO(period.dateLimiteNotes),
    bulletinDate: frToISO(period.dateBulletin),
    locked: false,
  };
}

/**
 * CORRECTION — crash "Une erreur est survenue" sur `AcademicResultsPage` au
 * chargement : des configurations existantes (seed, ou créées avant que
 * certains champs soient systématiquement renseignés) ont `periods`/
 * `updatedAt` à `null` côté Mongo. `.map`/`.slice` sur `null` levait une
 * `TypeError` NON enveloppée en `AppError` (elle ne traverse pas
 * `request()` — elle se produit APRÈS, dans ce mappeur), que `StateView`
 * affiche sous ce message générique faute de `AppError.message` à montrer.
 * Tous les champs potentiellement absents sont désormais traités en repli,
 * jamais en exception.
 */
function fromApiConfig(dto: AcademicYearConfigResponseDto): AcademicYearConfig {
  return {
    id: dto.id,
    levelTarget: dto.levelTarget ?? null,
    classId: dto.classId ?? null,
    periodType: API_TO_PERIOD_TYPE[dto.periodType] ?? 'semestre',
    semesterCount: dto.semesterCount ?? 2,
    periods: (dto.periods ?? []).map(fromApiPeriod),
    d1Weight: dto.d1Weight ?? 1,
    d2Weight: dto.d2Weight ?? 1,
    compositionWeight: dto.compositionWeight ?? 2,
    minPassAverage: dto.minPassAverage ?? 10,
    updatedAt: dto.updatedAt ? isoToFR(dto.updatedAt.slice(0, 10)) : '—',
  };
}

function fromApiSubjectAverage(dto: SubjectAverageDto): SubjectAverage {
  return {
    subjectId: dto.subjectId,
    subjectNom: dto.subjectName ?? '—',
    d1: dto.d1 ?? null,
    d2: dto.d2 ?? null,
    composition: dto.composition ?? null,
    moyenne: dto.average ?? 0,
    coefficient: dto.coefficient ?? 0,
    pointsPonderes: dto.weightedPoints ?? 0,
    mention: MENTION_TO_DOMAIN[dto.mention] ?? 'insuffisant',
  };
}

/** Résout prénom+nom pour tous les élèves de l'école — `Semester/YearResultResponse` ne porte que `studentId`. */
async function resolveStudentNames(schoolId: string): Promise<Map<string, string>> {
  const users = await request<UserResponseDto[]>(`/api/v1/users/school/${encodeURIComponent(schoolId)}`, {
    query: { role: 'STUDENT' },
  });
  return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
}

function fromApiSemesterResult(dto: SemesterResultResponseDto, names: Map<string, string>): SemesterResult {
  return {
    id: dto.id,
    studentId: dto.studentId,
    studentNom: names.get(dto.studentId) ?? '—',
    classId: dto.classId,
    semesterNumber: dto.semesterNumber,
    moyenneGenerale: dto.generalAverage ?? 0,
    rangClasse: dto.rankInClass ?? 0,
    totalEleves: dto.totalStudents ?? 0,
    mention: MENTION_TO_DOMAIN[dto.mention] ?? 'insuffisant',
    matieres: (dto.subjects ?? []).map(fromApiSubjectAverage),
    bulletinGenere: dto.bulletinGenerated ?? false,
    publie: dto.published ?? false,
  };
}

function fromApiYearResult(dto: YearResultResponseDto, names: Map<string, string>): YearResult {
  return {
    id: dto.id,
    studentId: dto.studentId,
    studentNom: names.get(dto.studentId) ?? '—',
    classId: dto.classId,
    moyenneAnnuelle: dto.annualAverage ?? 0,
    rangClasse: dto.rankInClass ?? 0,
    totalEleves: dto.totalStudents ?? 0,
    mention: MENTION_TO_DOMAIN[dto.mention] ?? 'insuffisant',
    decision: PROMOTION_TO_DOMAIN[dto.promotionResult] ?? 'redouble',
    matieres: (dto.subjects ?? []).map(fromApiSubjectAverage),
    cloture: dto.closed ?? false,
  };
}

/**
 * Portage réel complet (task #210) — `academic-service` (`AcademicConfigController`,
 * `GradeController`, `ResultController`). Backend confirmé entièrement existant avant
 * ce portage (aucun endpoint manquant) : pur travail de câblage frontend.
 */
export function createAcademicResultsApi(): AcademicResultsPort {
  async function getClassSemesterResults(classId: string, semesterNumber: number): Promise<SemesterResult[]> {
    const { schoolId } = sessionContext();
    const yearId = await resolveYearId();
    const [dtos, names] = await Promise.all([
      request<SemesterResultResponseDto[]>(
        `/api/v1/academic/results/class/${encodeURIComponent(classId)}/semester/${semesterNumber}`,
        { query: { yearId } },
      ),
      resolveStudentNames(schoolId),
    ]);
    return dtos.map((dto) => fromApiSemesterResult(dto, names));
  }

  return {
    async getEffectiveConfig(classId?: string): Promise<AcademicYearConfig | null> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      try {
        const dto = await request<AcademicYearConfigResponseDto>('/api/v1/academic/config/effective', {
          query: { schoolId, yearId, classId },
        });
        return fromApiConfig(dto);
      } catch (err) {
        // CORRECTION — `getEffectiveConfig` lève une `BusinessException` (422, pas 404)
        // quand aucune configuration n'existe à AUCUNE portée (classe/niveau/école) —
        // c'est un état normal en début d'année, pas une panne.
        if (err instanceof AppError && err.kind === 'validation') return null;
        throw err;
      }
    },

    async configure(input): Promise<AcademicYearConfig> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      const body: ConfigureAcademicYearRequestDto = {
        schoolId,
        academicYearId: yearId,
        classId: input.classId,
        levelTarget: null,
        periodType: PERIOD_TYPE_TO_API[input.periodType],
        semesterCount: input.semesterCount,
        periods: input.periods.map(toApiPeriod),
        d1Weight: input.d1Weight,
        d2Weight: input.d2Weight,
        compositionWeight: input.compositionWeight,
        minPassAverage: input.minPassAverage,
      };
      const dto = await request<AcademicYearConfigResponseDto>('/api/v1/academic/config', { method: 'POST', body });
      return fromApiConfig(dto);
    },

    async lockGrades(classId: string, subjectId: string, semesterNumber: number): Promise<void> {
      await request<void>('/api/v1/academic/grades/lock', {
        method: 'PUT',
        query: { classId, subjectId, semesterNumber },
      });
    },

    async computeClassAverages(classId: string, semesterNumber: number): Promise<void> {
      const yearId = await resolveYearId();
      await request<void>(`/api/v1/academic/averages/class/${encodeURIComponent(classId)}/semester/${semesterNumber}`, {
        method: 'POST',
        query: { yearId },
      });
    },

    async computeClassResults(classId: string, semesterNumber: number): Promise<void> {
      const yearId = await resolveYearId();
      await request<void>(`/api/v1/academic/results/class/${encodeURIComponent(classId)}/semester/${semesterNumber}`, {
        method: 'POST',
        query: { yearId },
      });
    },

    getClassSemesterResults,

    async getClassAverage(classId: string, semesterNumber: number): Promise<number | null> {
      const yearId = await resolveYearId();
      const dtos = await request<SemesterResultResponseDto[]>(
        `/api/v1/academic/results/class/${encodeURIComponent(classId)}/semester/${semesterNumber}`,
        { query: { yearId } },
      );
      if (dtos.length === 0) return null;
      const avg = dtos.reduce((a, d) => a + d.generalAverage, 0) / dtos.length;
      return Math.round(avg * 10) / 10;
    },

    async getStudentAverage(studentId: string, classId: string): Promise<number | null> {
      const yearId = await resolveYearId();
      // Nombre de périodes (semestres/trimestres) de la config effective — à
      // défaut 2. On lit le dernier résultat disponible : on balaie de la
      // dernière période vers la première, un 404 (RESULT_NOT_AVAILABLE) étant
      // l'état normal tant que les moyennes ne sont pas calculées.
      let periodCount = 2;
      try {
        const cfg = await this.getEffectiveConfig(classId);
        if (cfg?.semesterCount) periodCount = cfg.semesterCount;
      } catch {
        // config absente en début d'année — on garde 2 par défaut.
      }
      for (let sem = periodCount; sem >= 1; sem--) {
        try {
          const dto = await request<SemesterResultResponseDto>(
            `/api/v1/academic/results/student/${encodeURIComponent(studentId)}/semester/${sem}`,
            { query: { yearId } },
          );
          if (dto && typeof dto.generalAverage === 'number') {
            return Math.round(dto.generalAverage * 10) / 10;
          }
        } catch (err) {
          if (err instanceof AppError && err.kind === 'notFound') continue;
          // Autre erreur (réseau, 500) : on n'invente pas de moyenne.
          return null;
        }
      }
      return null;
    },

    async publishResults(classId: string, semesterNumber: number): Promise<SemesterResult[]> {
      const yearId = await resolveYearId();
      await request<SemesterResultResponseDto>(
        `/api/v1/academic/results/class/${encodeURIComponent(classId)}/semester/${semesterNumber}/publish`,
        { method: 'PUT', query: { yearId } },
      );
      // CORRECTION — la route ne rend qu'UNE ligne représentative (voir
      // `AcademicServiceImpl.publishResults`), alors que l'effet réel publie
      // TOUTE la classe : on relit la liste complète plutôt que de ne
      // renvoyer que cette ligne unique à l'appelant.
      return getClassSemesterResults(classId, semesterNumber);
    },

    async generateStudentBulletin(studentId: string, semesterNumber: number): Promise<void> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      await request<SemesterResultResponseDto>(
        `/api/v1/academic/bulletins/student/${encodeURIComponent(studentId)}/semester/${semesterNumber}`,
        { method: 'POST', query: { schoolId, yearId } },
      );
    },

    async generateClassBulletins(classId: string, semesterNumber: number): Promise<void> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      await request<void>(
        `/api/v1/academic/bulletins/class/${encodeURIComponent(classId)}/semester/${semesterNumber}`,
        { method: 'POST', query: { schoolId, yearId } },
      );
    },

    async downloadBulletinPdf(studentId: string, semesterNumber: number): Promise<void> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      // Le nom de fichier ne doit jamais exposer l'id de l'élève — on résout
      // son prénom/nom pour construire un nom lisible à la place.
      const [blob, student] = await Promise.all([
        request<Blob>(
          `/api/v1/academic/bulletins/student/${encodeURIComponent(studentId)}/semester/${semesterNumber}/pdf`,
          { query: { schoolId, yearId }, responseType: 'blob' },
        ),
        request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(studentId)}`),
      ]);
      downloadBlob(blob, buildDownloadFilename('bulletin', student.firstName, student.lastName, { semesterNumber }));
    },

    async getClassYearResults(classId: string): Promise<YearResult[]> {
      const { schoolId } = sessionContext();
      const yearId = await resolveYearId();
      const [dtos, names] = await Promise.all([
        request<YearResultResponseDto[]>(`/api/v1/academic/results/class/${encodeURIComponent(classId)}/annual`, {
          query: { yearId },
        }),
        resolveStudentNames(schoolId),
      ]);
      return dtos.map((dto) => fromApiYearResult(dto, names));
    },

    async closeResultsYear(overrides): Promise<void> {
      const { schoolId, userId } = sessionContext();
      const yearId = await resolveYearId();
      // `directorSignature` n'a pas d'écran de saisie dédié — comme les
      // signatures groupées/individuelles de `signatures.api.ts`, l'acte de
      // cliquer le bouton EST la signature ; on y porte le nom du directeur
      // authentifié plutôt que de lui faire retaper son nom.
      const director = await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(userId)}`);
      const body: CloseYearRequestDto = {
        schoolId,
        academicYearId: yearId,
        directorSignature: `${director.firstName} ${director.lastName}`,
        scope: 'ALL',
        // task #234 : passages exceptionnels (ou toute autre décision forcée) décidés par
        // le directeur avant clôture — les élèves absents d'ici suivent le calcul automatique.
        overrides: overrides?.length
          ? overrides.map((o) => ({
              studentId: o.studentId,
              classId: o.classId,
              annualAverage: o.moyenneAnnuelle,
              finalResult: DOMAIN_TO_PROMOTION[o.decision],
              directorNote: o.note.trim() ? o.note.trim() : null,
            }))
          : undefined,
      };
      await request<void>('/api/v1/academic/year/close', { method: 'POST', body });
    },
  };
}
