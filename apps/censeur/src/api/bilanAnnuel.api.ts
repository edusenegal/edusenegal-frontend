import { request, sessionContext } from '@/api/client';
import type { AcademicYearDto, AttendanceStatsResponseDto, ClassInfoDto, LedgerResponseDto, YearResultResponseDto } from '@/types/api';
import type { BilanAnnuelPort } from '@/services/ports';
import type { AnnualFigure, BilanAnnuel, NiveauReussite } from '@/types/domain';

const round1 = (n: number) => Math.round(n * 10) / 10;

function pct(valeur: number, ref: number | null): number | null {
  if (ref === null || ref === 0) return null;
  return Math.round(((valeur - ref) / ref) * 1000) / 10;
}

function figure(valeur: number, ref: number | null): AnnualFigure {
  return { valeurActuelle: valeur, valeurPrecedente: ref, variationPct: pct(valeur, ref) };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchYears(schoolId: string): Promise<AcademicYearDto[]> {
  return request<AcademicYearDto[]>(`/api/v1/schools/${encodeURIComponent(schoolId)}/academic-years`);
}

/** La plus récente en premier ; "actuelle" = celle marquée ACTIVE (sinon la plus récente). */
function currentAndPrevious(years: AcademicYearDto[]): { current: AcademicYearDto; previous: AcademicYearDto | null } {
  const sorted = [...years].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const current = sorted.find((y) => y.status === 'ACTIVE') ?? sorted[0];
  if (!current) throw new Error('Aucune année scolaire pour cet établissement.');
  const idx = sorted.findIndex((y) => y.id === current.id);
  return { current, previous: sorted[idx + 1] ?? null };
}

async function classesForYear(schoolId: string, yearId: string): Promise<ClassInfoDto[]> {
  return request<ClassInfoDto[]>(`/api/v1/classes/school/${encodeURIComponent(schoolId)}/year/${encodeURIComponent(yearId)}`);
}

/** `Set` : un élève présent dans deux classes la même année (transfert interne) ne compte qu'une fois. */
function headcount(classes: ClassInfoDto[]): number {
  const ids = new Set<string>();
  for (const klass of classes) for (const id of klass.studentIds) ids.add(id);
  return ids.size;
}

async function ledgerFor(schoolId: string, yearId: string): Promise<LedgerResponseDto | null> {
  try {
    return await request<LedgerResponseDto>('/api/v1/accounting/ledger', { query: { schoolId, academicYearId: yearId } });
  } catch {
    return null;
  }
}

async function attendanceStatsFor(schoolId: string, from: string, to: string): Promise<AttendanceStatsResponseDto | null> {
  try {
    return await request<AttendanceStatsResponseDto>('/api/v1/attendances/analytics/school/stats', { query: { schoolId, from, to } });
  } catch {
    return null;
  }
}

/** Résultats annuels par classe (avec le niveau de la classe conservé). */
async function resultsByClass(classes: ClassInfoDto[], yearId: string): Promise<{ klass: ClassInfoDto; results: YearResultResponseDto[] }[]> {
  return Promise.all(
    classes.map(async (klass) => ({
      klass,
      results: await request<YearResultResponseDto[]>(`/api/v1/academic/results/class/${encodeURIComponent(klass.id)}/annual`, {
        query: { yearId },
      }).catch(() => [] as YearResultResponseDto[]),
    })),
  );
}

const isAdmis = (r: YearResultResponseDto) => r.promotionResult === 'PROMOTED' || r.promotionResult === 'EXCEPTIONAL';

interface Gathered {
  classes: ClassInfoDto[];
  ledger: LedgerResponseDto | null;
  byClass: { klass: ClassInfoDto; results: YearResultResponseDto[] }[];
  att: AttendanceStatsResponseDto | null;
}

/**
 * Agrège, pour une année, les données brutes des différents services
 * (classes, grand livre, résultats annuels, assiduité). Chaque endpoint
 * accepte un `academicYearId`/`yearId` arbitraire — on peut donc recalculer
 * l'année précédente à l'identique pour les comparaisons.
 */
async function gather(schoolId: string, year: AcademicYearDto): Promise<Gathered> {
  const classes = await classesForYear(schoolId, year.id);
  const today = isoDate(new Date());
  const to = year.endDate < today ? year.endDate : today;
  const [ledger, byClass, att] = await Promise.all([
    ledgerFor(schoolId, year.id),
    resultsByClass(classes, year.id),
    attendanceStatsFor(schoolId, year.startDate, to),
  ]);
  return { classes, ledger, byClass, att };
}

interface Totals {
  effectif: number;
  recettes: number;
  depenses: number;
  solde: number;
  tauxReussite: number;
  tauxPresence: number;
  moyenneGenerale: number;
}

function totals(g: Gathered): Totals {
  const flat = g.byClass.flatMap((c) => c.results);
  const tauxReussite = flat.length ? round1((flat.filter(isAdmis).length / flat.length) * 100) : 0;
  const moyenneGenerale = flat.length ? round1(flat.reduce((s, r) => s + r.annualAverage, 0) / flat.length) : 0;
  return {
    effectif: headcount(g.classes),
    recettes: g.ledger?.totalIncomesFcfa ?? 0,
    depenses: g.ledger?.totalExpensesFcfa ?? 0,
    solde: g.ledger?.balanceFcfa ?? 0,
    tauxReussite,
    tauxPresence: g.att && g.att.totalRecords > 0 ? round1(g.att.attendanceRate) : 0,
    moyenneGenerale,
  };
}

/** Réussite agrégée par niveau de classe (« 2nde », « 1ère »…), année en cours. */
function reussiteParNiveau(byClass: Gathered['byClass']): NiveauReussite[] {
  const map = new Map<string, { admis: number; total: number }>();
  for (const { klass, results } of byClass) {
    const e = map.get(klass.level) ?? { admis: 0, total: 0 };
    e.total += results.length;
    e.admis += results.filter(isAdmis).length;
    map.set(klass.level, e);
  }
  return [...map.entries()]
    .filter(([, e]) => e.total > 0)
    .map(([niveau, e]) => ({ niveau, taux: round1((e.admis / e.total) * 100), effectif: e.total }))
    .sort((a, b) => a.niveau.localeCompare(b.niveau, 'fr'));
}

/**
 * Portage réel (task #237, enrichi) — bilan composé entièrement côté client :
 * aucun endpoint n'agrège un bilan annuel côté backend. Les six figures
 * comparées N vs N-1 sont conservées ; s'y ajoutent, pour l'année en cours,
 * la moyenne générale (avec sa comparaison), le nombre de mentions, le taux de
 * retard, la réussite par niveau et la répartition des pointages — tous
 * dérivés des mêmes endpoints, sans nouvel appel backend par rapport à
 * l'existant hormis la conservation du détail déjà récupéré.
 */
export function createBilanAnnuelApi(): BilanAnnuelPort {
  return {
    async getBilan(): Promise<BilanAnnuel> {
      const { schoolId } = sessionContext();
      const years = await fetchYears(schoolId);
      const { current, previous } = currentAndPrevious(years);

      const [gCur, gPrev] = await Promise.all([gather(schoolId, current), previous ? gather(schoolId, previous) : Promise.resolve(null)]);

      const tCur = totals(gCur);
      const tPrev = gPrev ? totals(gPrev) : null;

      const flat = gCur.byClass.flatMap((c) => c.results);
      const mentions = flat.filter((r) => r.mention !== 'INSUFFISANT').length;
      const att = gCur.att;
      const tauxRetard = att && att.totalRecords > 0 ? round1((att.totalLate / att.totalRecords) * 100) : 0;

      return {
        anneeActuelle: current.label,
        anneePrecedente: previous?.label ?? null,
        effectif: figure(tCur.effectif, tPrev?.effectif ?? null),
        recettes: figure(tCur.recettes, tPrev?.recettes ?? null),
        depenses: figure(tCur.depenses, tPrev?.depenses ?? null),
        solde: figure(tCur.solde, tPrev?.solde ?? null),
        tauxReussite: figure(tCur.tauxReussite, tPrev?.tauxReussite ?? null),
        tauxPresence: figure(tCur.tauxPresence, tPrev?.tauxPresence ?? null),
        moyenneGenerale: figure(tCur.moyenneGenerale, tPrev?.moyenneGenerale ?? null),
        mentions,
        tauxRetard,
        reussiteParNiveau: reussiteParNiveau(gCur.byClass),
        presence: {
          present: att?.totalPresent ?? 0,
          absent: att?.totalAbsent ?? 0,
          retard: att?.totalLate ?? 0,
        },
      };
    },
  };
}
