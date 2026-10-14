import type { ClassLevel, PaymentConfig } from '@/types/domain';

/**
 * Brouillon d'une ligne de classe à l'étape « Classes » de l'assistant.
 *
 * `existing: true` signifie que la ligne correspond à une classe réelle déjà
 * créée dans l'établissement (préremplie à l'ouverture de l'assistant) ;
 * `false` signifie qu'elle sera créée par cet envoi. Dans les deux cas,
 * l'envoi final fait un upsert par nom calculé (niveau + série + tag) — voir
 * `SchoolPort.openAcademicYear` — donc cette distinction ne change rien à
 * l'envoi, elle sert seulement à l'affichage (pas de badge « nouveau » sur
 * une classe qui existe déjà).
 */
export interface ClassDraftRow {
  key: string;
  level: ClassLevel;
  series: string | null;
  tag: string | null;
  capacite: number;
  existing: boolean;
}

/**
 * Brouillon d'une matière à l'étape « Matières & coefficients ».
 *
 * `coefs` est indexé par `levelSeriesKey(level, série)` (voir `catalog.ts`)
 * plutôt que par `classeId` : à ce stade, les classes de l'étape précédente
 * ne sont pas encore créées, donc il n'y a pas encore de vrais `classeId` à
 * utiliser — c'est précisément ce que `OpenYearSubjectCoefInput` documente
 * côté `ports.ts` (résolution en vraies classes au moment de l'ouverture).
 */
export interface SubjectDraftRow {
  key: string;
  code: string;
  nom: string;
  optionnelle: boolean;
  existing: boolean;
  coefs: Record<string, { valeur: number; enseignee: boolean }>;
}

export type PaymentDraft = Omit<PaymentConfig, 'id' | 'updatedAt'>;
