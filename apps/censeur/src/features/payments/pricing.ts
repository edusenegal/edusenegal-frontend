/**
 * Libellés et calculs partagés par l'écran Paiements dédié
 * (`PaymentConfigPage`) et par l'étape Paiements de l'assistant d'ouverture
 * d'année (`wizard/PaymentsStep`, `wizard/ConfirmationStep`) — un seul
 * endroit pour cette logique, pour que les deux écrans ne puissent pas
 * diverger silencieusement.
 *
 * Isolé dans un fichier sans composant React pour que les deux écrans qui
 * l'importent restent compatibles avec le fast refresh (règle
 * `react-refresh/only-export-components`).
 */
import type { LevelPricing, PaymentChannel, PaymentType } from '@/types/domain';

export const TYPE_LABELS: Record<PaymentType, string> = {
  inscription_seule: 'Inscription seule',
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  annuel: 'Annuel',
  inscription_mensuel: 'Inscription + mensualités',
  inscription_trimestriel: 'Inscription + trimestres',
  inscription_annuel: 'Inscription + annuel',
  bourse: 'Boursier (pris en charge)',
};

export const CHANNEL_LABELS: Record<PaymentChannel, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  especes: 'Espèces',
  cheque: 'Chèque',
  virement_bancaire: 'Virement bancaire',
};

/** Nombre de périodes facturées sur l'année scolaire, selon le mode choisi. */
export function periodsForType(type: PaymentType): number {
  switch (type) {
    case 'inscription_seule':
    case 'bourse':
      return 0;
    case 'mensuel':
    case 'inscription_mensuel':
      return 10;
    case 'trimestriel':
    case 'inscription_trimestriel':
      return 3;
    case 'annuel':
    case 'inscription_annuel':
      return 1;
  }
}

export function totalFor(row: LevelPricing, type: PaymentType): number {
  return row.inscriptionFcfa + row.periodFcfa * periodsForType(type);
}

export function emptyLevelPricingRow(): LevelPricing {
  return { level: '', series: null, displayName: '', inscriptionFcfa: 0, periodFcfa: 0, totalAnnualFcfa: 0 };
}

/**
 * Description courte par mode — reprise de l'assistant d'onboarding de
 * référence (`10_onboarding_v2_updated.html`, étape Paiements), utilisée
 * par les « cartes » de sélection du mode dans l'assistant d'ouverture
 * d'année (`wizard/PaymentsStep`).
 */
export const TYPE_DESCRIPTIONS: Record<PaymentType, string> = {
  inscription_seule: "Paiement unique à l'entrée",
  mensuel: 'Paiement chaque mois',
  trimestriel: "3 versements dans l'année",
  annuel: 'Paiement annuel global',
  inscription_mensuel: "Frais d'entrée + mensualités",
  inscription_trimestriel: "Frais d'entrée + 3 versements",
  inscription_annuel: "Frais d'entrée + paiement annuel",
  bourse: 'Frais pris en charge par une bourse — aucun tarif à saisir',
};

/** Le mode comporte-t-il des frais d'inscription ? (colonne « Inscription » du tableau de tarifs) */
export function hasInscriptionComponent(type: PaymentType): boolean {
  return (
    type === 'inscription_seule' ||
    type === 'inscription_mensuel' ||
    type === 'inscription_trimestriel' ||
    type === 'inscription_annuel'
  );
}

/** Le mode comporte-t-il une périodicité récurrente ? (colonne « Mensuel »/« Trimestriel »/« Annuel ») */
export function hasPeriodComponent(type: PaymentType): boolean {
  return periodsForType(type) > 0;
}

/** Libellé de la colonne de périodicité, dynamique selon le mode choisi. */
export function periodColumnLabel(type: PaymentType): string {
  switch (type) {
    case 'mensuel':
    case 'inscription_mensuel':
      return 'Mensuel';
    case 'trimestriel':
    case 'inscription_trimestriel':
      return 'Trimestriel';
    case 'annuel':
    case 'inscription_annuel':
      return 'Annuel';
    case 'inscription_seule':
    case 'bourse':
      return '';
  }
}

/**
 * Resynchronise les tarifs par niveau sur les niveaux réellement couverts
 * par les classes de l'assistant (`activeLevels`, dédupliqués niveau par
 * niveau — jamais par classe ni par série) : un niveau devenu actif reçoit
 * une ligne (reprise si elle existait déjà, à 0 sinon), un niveau qui n'a
 * plus aucune classe perd sa ligne. Un seul tarif par niveau, partagé par
 * toutes les séries/tags de ce niveau — jamais un tarif par classe.
 */
export function syncLevelPricingsByLevel(current: LevelPricing[], activeLevels: string[]): LevelPricing[] {
  return activeLevels.map((level) => {
    const existing = current.find((r) => r.level === level);
    return existing
      ? { ...existing, level, series: null, displayName: level }
      : { level, series: null, displayName: level, inscriptionFcfa: 0, periodFcfa: 0, totalAnnualFcfa: 0 };
  });
}
