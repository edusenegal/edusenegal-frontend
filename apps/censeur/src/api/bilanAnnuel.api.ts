import { request, sessionContext } from '@/api/client';
import type { AcademicYearDto, AttendanceStatsResponseDto, ClassInfoDto, LedgerResponseDto, YearResultResponseDto } from '@/types/api';
import type { BilanAnnuelPort } from '@/services/ports';
import type { AnnualFigure, BilanAnnuel } from '@/types/domain';

function pct(valeur: number, ref: number | null): number | null {
  if (ref === null || ref === 0) return null;
  return Math.round(((valeur - ref) / ref) * 1000) / 10;
}

function figure(valeur: number, ref: number | null): AnnualFigure {
  return { valeurActuelle: valeur, valeurPrecedente: ref, variationPct: pct(valeur, ref) };
}

async function fetchYears(schoolId: string): Promise<AcademicYearDto[]> {
  return request<AcademicYearDto[]>(`/api/v1/schools/${encodeURIComponent(schoolId)}/academic-years`);
}

/** La plus récente en premier ; "actuelle" = celle marquée ACTIVE (sinon la plus récente). */
function currentAndPrevious(years: AcademicYearDto[]): { current: AcademicYearDto; previous: AcademicYearDto | null } {
  const sorted = [...years].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const current = sorted.find((y) => y.status === 'ACTIVE') ?? sorted[0];
  if (!current) {
    throw new Error('Aucune année scolaire pour cet établissement.');
  }
  const idx = sorted.findIndex((y) => y.id === current.id);
  return { current, previous: sorted[idx + 1] ?? null };
}

async function classesForYear(schoolId: string, yearId: string): Promise<ClassInfoDto[]> {
  return request<ClassInfoDto[]>(`/api/v1/classes/school/${encodeURIComponent(schoolId)}/year/${encodeURIComponent(yearId)}`);
}

/** `Set` plutôt qu'une somme de `studentIds.length` — un élève ne doit compter qu'une fois
 * si jamais il apparaît dans deux classes la même année (transfert interne en cours d'année). */
function headcount(classes: ClassInfoDto[]): number {
  const ids = new Set<string>();
  for (const klass of classes) {
    for (const studentId of klass.studentIds) ids.add(studentId);
  }
  return ids.size;
}

/** `null` plutôt qu'une erreur propagée : une année sans aucune activité financière
 * (toute première année de l'école, par exemple) n'a simplement pas encore de grand livre. */
async function ledgerFor(schoolId: string, yearId: string): Promise<LedgerResponseDto | null> {
  try {
    return await request<LedgerResponseDto>('/api/v1/accounting/ledger', {
      query: { schoolId, academicYearId: yearId },
    });
  } catch {
    return null;
  }
}

/** % d'élèves admis (PROMOTED ou EXCEPTIONAL) sur l'ensemble des résultats annuels calculés
 * pour cette année — une classe sans résultat calculable (aucun semestre publié) compte pour
 * zéro résultat plutôt que de faire échouer tout le bilan. */
async function passRateFor(classes: ClassInfoDto[], yearId: string): Promise<number> {
  const perClass = await Promise.all(
    classes.map((klass) =>
      request<YearResultResponseDto[]>(`/api/v1/academic/results/class/${encodeURIComponent(klass.id)}/annual`, {
        query: { yearId },
      }).catch(() => [] as YearResultResponseDto[]),
    ),
  );
  const all = perClass.flat();
  if (all.length === 0) return 0;
  const admis = all.filter((r) => r.promotionResult === 'PROMOTED' || r.promotionResult === 'EXCEPTIONAL').length;
  return Math.round((admis / all.length) * 1000) / 10;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function attendanceRateFor(schoolId: string, from: string, to: string): Promise<number> {
  const stats = await request<AttendanceStatsResponseDto>('/api/v1/attendances/analytics/school/stats', {
    query: { schoolId, from, to },
  });
  return stats.totalRecords > 0 ? Math.round(stats.attendanceRate * 10) / 10 : 0;
}

interface YearlyTotals {
  effectif: number;
  recettes: number;
  depenses: number;
  solde: number;
  tauxReussite: number;
  tauxPresence: number;
}

async function summarize(schoolId: string, year: AcademicYearDto): Promise<YearlyTotals> {
  const classes = await classesForYear(schoolId, year.id);
  const today = isoDate(new Date());
  const to = year.endDate < today ? year.endDate : today;

  const [ledger, tauxReussite, tauxPresence] = await Promise.all([
    ledgerFor(schoolId, year.id),
    passRateFor(classes, year.id),
    attendanceRateFor(schoolId, year.startDate, to),
  ]);

  return {
    effectif: headcount(classes),
    recettes: ledger?.totalIncomesFcfa ?? 0,
    depenses: ledger?.totalExpensesFcfa ?? 0,
    solde: ledger?.balanceFcfa ?? 0,
    tauxReussite,
    tauxPresence,
  };
}

/**
 * Portage réel (task #237) — composé entièrement côté client, comme
 * `createDashboardApi` : aucun endpoint n'agrège un bilan annuel côté
 * backend. Le vrai travail est de retrouver l'année PRÉCÉDENTE (pas
 * seulement l'année active) et de recalculer les six mêmes agrégats pour
 * elle — chaque endpoint sous-jacent accepte un `academicYearId`/`yearId`
 * arbitraire, pas seulement celui de l'année active (vérifié sur
 * `LedgerController`, `AcademicServiceImpl.getClassYearResults`,
 * `AttendanceController.getSchoolStats`, `GET .../classes/school/{id}/year/{yearId}`).
 *
 * Seule l'école qui n'a pas encore d'année précédente (toute nouvelle école,
 * ou une école qui n'a jamais clôturé d'année) n'a pas de comparaison : les
 * six `AnnualFigure.variationPct` valent alors `null`, et l'écran l'affiche
 * comme telle plutôt que "0%".
 */
export function createBilanAnnuelApi(): BilanAnnuelPort {
  return {
    async getBilan(): Promise<BilanAnnuel> {
      const { schoolId } = sessionContext();
      const years = await fetchYears(schoolId);
      const { current, previous } = currentAndPrevious(years);

      const [curr, prev] = await Promise.all([
        summarize(schoolId, current),
        previous ? summarize(schoolId, previous) : Promise.resolve(null),
      ]);

      return {
        anneeActuelle: current.label,
        anneePrecedente: previous?.label ?? null,
        effectif: figure(curr.effectif, prev?.effectif ?? null),
        recettes: figure(curr.recettes, prev?.recettes ?? null),
        depenses: figure(curr.depenses, prev?.depenses ?? null),
        solde: figure(curr.solde, prev?.solde ?? null),
        tauxReussite: figure(curr.tauxReussite, prev?.tauxReussite ?? null),
        tauxPresence: figure(curr.tauxPresence, prev?.tauxPresence ?? null),
      };
    },
  };
}
