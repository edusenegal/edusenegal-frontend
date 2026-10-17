import type { ClassLevel } from '@/types/domain';

/**
 * Catalogue niveau × série du lycée sénégalais.
 *
 * Porté depuis l'assistant d'onboarding de référence (`10_onboarding_v2_updated.html`,
 * branche LYCEE de `LYCEE_LEVELS`) : Seconde n'a pas de série par défaut mais
 * peut en recevoir une (tronc commun scientifique/littéraire les premières
 * années du nouveau système), Première et Terminale se déclinent en séries
 * S1/S2/L/G/T (+ STEG en Terminale). 15 combinaisons au total — c'est ce
 * total qu'affiche l'écran « Actif : X/15 niveaux » par matière.
 *
 * Cette application est volontairement limitée au lycée (voir le périmètre
 * du projet) : on porte donc fidèlement la branche LYCEE de référence plutôt
 * que les branches Collège/Primaire/Préscolaire, qui ne pourraient jamais
 * s'exécuter ici.
 */
export interface LevelSeries {
  level: ClassLevel;
  series: string | null;
}

export const LYCEE_SERIES_BY_LEVEL: Record<ClassLevel, (string | null)[]> = {
  Seconde: [null,'S', 'L', 'G', 'T', ],
  Première: ['S1', 'S2', 'L1','L2', 'G', 'T'],
  Terminale: ['S1', 'S2', 'L1','L2','L4', 'G', 'T', 'STEG'],
};

export const LYCEE_LEVEL_SERIES: LevelSeries[] = (['Seconde', 'Première', 'Terminale'] as ClassLevel[]).flatMap(
  (level) => LYCEE_SERIES_BY_LEVEL[level].map((series) => ({ level, series })),
);

export function levelSeriesKey(level: ClassLevel, series: string | null): string {
  return series ? `${level}-${series}` : level;
}

export function levelSeriesDisplay(level: ClassLevel, series: string | null): string {
  return series ? `${level} ${series}` : level;
}

/**
 * Coefficients par défaut, par matière et par couple niveau/série — repris
 * du catalogue par défaut de l'assistant d'onboarding (`LYCEE_DEFAULT_SUBJECTS`).
 * Sert uniquement à préremplir une combinaison niveau/série qu'aucune classe
 * réelle ne couvre encore aujourd'hui (ex. « Terminale G ») ; partout où une
 * classe existe déjà, ses coefficients réels (subject-service) priment.
 */
export const LYCEE_SUBJECT_DEFAULT_COEFS: Record<string, Partial<Record<string, number>>> = {
  MATH: { Seconde: 4, 'Première-S1': 7, 'Première-S2': 7, 'Première-L': 3, 'Première-G': 3, 'Terminale-S1': 8, 'Terminale-S2': 7, 'Terminale-L': 3, 'Terminale-G': 4 },
  FR: { Seconde: 4, 'Première-S1': 3, 'Première-L': 5, 'Terminale-S2': 3, 'Terminale-L': 5 },
  SVT: { 'Première-S1': 5, 'Terminale-S2': 5, 'Terminale-S1': 5 },
  PC: { Seconde: 3, 'Première-S1': 5, 'Terminale-S2': 5, 'Terminale-S1': 5 },
  HG: { Seconde: 3, 'Première-L': 4, 'Terminale-L': 4, 'Terminale-S2': 2 },
  ANG: { Seconde: 2, 'Première-S1': 2, 'Terminale-S2': 2 },
  ESP: { Seconde: 1, 'Première-L': 2, 'Terminale-L': 2 },
  EPS: { Seconde: 2, 'Première-S1': 2, 'Terminale-S2': 2 },
  PHILO: { 'Terminale-S2': 3, 'Terminale-L': 4, 'Terminale-G': 3 },
};

export function defaultCoefficientFor(code: string, level: ClassLevel, series: string | null): number {
  return LYCEE_SUBJECT_DEFAULT_COEFS[code]?.[levelSeriesKey(level, series)] ?? 0;
}
