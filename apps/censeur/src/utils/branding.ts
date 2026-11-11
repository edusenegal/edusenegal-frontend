import type { School } from '@/types/domain';

/* ── Utilitaires couleur (dérivation de nuances cohérentes) ─────────────── */

/** `#abc` ou `#aabbcc` → {r,g,b}. `null` si la chaîne n'est pas un hex valide. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const raw = m[1];
  if (!raw) return null;
  let h = raw;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mélange `hex` vers `target` d'une proportion `amount` (0→hex, 1→target). */
function mix(rgb: { r: number; g: number; b: number }, target: { r: number; g: number; b: number }, amount: number): string {
  return toHex(
    rgb.r + (target.r - rgb.r) * amount,
    rgb.g + (target.g - rgb.g) * amount,
    rgb.b + (target.b - rgb.b) * amount,
  );
}

const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

/** Luminance perçue [0..1] — choisit un texte lisible sur la couleur de marque. */
function luminance(rgb: { r: number; g: number; b: number }): number {
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

/**
 * Applique la couleur de marque de l'établissement aux jetons CSS.
 *
 * Appelée une fois au chargement (avec l'école courante) et après tout
 * changement dans `Paramètres` — jamais de couleur en dur dans un
 * composant, toujours cette seule fonction qui écrit sur `:root`.
 *
 * La couleur secondaire alimente TOUTE la famille `--brand-primary-*`
 * (fond, survol « strong », tons « soft », texte au contraste) : sinon le
 * fond prend la couleur de l'école mais le survol/les tons restent sur la
 * valeur verte par défaut, d'où des boutons qui « se dédoublent »
 * (fond d'une couleur, survol + ombre d'une autre).
 */
export function applyBranding(school: Pick<School, 'primaryColor' | 'secondaryColor'>): void {
  const root = document.documentElement;
  // Primaire → fond de la barre latérale ; secondaire → boutons et accents.
  root.style.setProperty('--brand-sidebar-bg', school.primaryColor);
  root.style.setProperty('--brand-primary', school.secondaryColor);

  const rgb = hexToRgb(school.secondaryColor);
  if (!rgb) return; // couleur non hex : on garde les nuances par défaut des tokens.

  // Nuances dérivées, cohérentes avec la teinte de l'école.
  root.style.setProperty('--brand-primary-strong', mix(rgb, BLACK, 0.24));
  root.style.setProperty('--brand-primary-soft', mix(rgb, WHITE, 0.86));
  root.style.setProperty('--brand-on-primary', luminance(rgb) > 0.6 ? '#1b2733' : '#ffffff');
}
