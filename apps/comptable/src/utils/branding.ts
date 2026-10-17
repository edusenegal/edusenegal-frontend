import type { School } from '@/types/domain';

/**
 * Applique la couleur de marque de l'établissement aux jetons CSS.
 *
 * Appelée une fois au chargement (avec l'école courante) et après tout
 * changement dans `Paramètres` — jamais de couleur en dur dans un
 * composant, toujours cette seule fonction qui écrit sur `:root`.
 */
export function applyBranding(school: Pick<School, 'brandColor'>): void {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', school.brandColor);
}
