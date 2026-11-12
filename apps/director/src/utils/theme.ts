/**
 * Thème clair / sombre / système.
 *
 * - La préférence est stockée dans `localStorage` (clé `edusenegal-theme`).
 * - « system » = aucun attribut `data-theme` : les tokens suivent
 *   `prefers-color-scheme`. « light »/« dark » posent l'attribut sur <html>.
 * - `index.html` contient un mini-script qui applique la préférence AVANT le
 *   premier rendu (pas de flash blanc) ; ce module reprend ensuite la main.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'edusenegal-theme';
const listeners = new Set<(pref: ThemePreference) => void>();

function readStorage(): ThemePreference {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function getThemePreference(): ThemePreference {
  return readStorage();
}

/** Thème effectivement affiché (résout « system »). */
export function getResolvedTheme(pref: ThemePreference = readStorage()): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyToDocument(pref: ThemePreference): void {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  // Couleur de la barre d'adresse mobile en phase avec le fond.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = getResolvedTheme(pref) === 'dark' ? '#0b1020' : '#f4f6fb';
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // stockage indisponible (navigation privée) : on applique quand même.
  }
  applyToDocument(pref);
  listeners.forEach((l) => l(pref));
}

/** S'abonner aux changements de préférence (pour les composants). */
export function onThemeChange(listener: (pref: ThemePreference) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** À appeler une fois au démarrage : réapplique la préférence et suit le système. */
export function initTheme(): void {
  applyToDocument(readStorage());
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (readStorage() === 'system') applyToDocument('system');
  });
}
