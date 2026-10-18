import type { School } from '@/types/domain';

/**
 * Applique la couleur de marque de l'établissement aux jetons CSS.
 *
 * Appelée une fois au chargement (avec l'école courante) et après tout
 * changement dans `Paramètres` — jamais de couleur en dur dans un
 * composant, toujours cette seule fonction qui écrit sur `:root`.
 */
export function applyBranding(school: Pick<School, 'primaryColor' | 'secondaryColor'>): void {
  const root = document.documentElement;
  // Primaire → fond de la barre latérale ; secondaire → boutons et section
  // choisie dans le menu (ce qu'occupait l'unique `--brand-primary` avant
  // task #231 — les composants qui le consomment n'ont pas changé).
  root.style.setProperty('--brand-sidebar-bg', school.primaryColor);
  root.style.setProperty('--brand-primary', school.secondaryColor);
}
