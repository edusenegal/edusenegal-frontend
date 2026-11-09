/**
 * Formatage partagé — devise, dates, initiales.
 *
 * Centralisé ici pour qu'aucun écran n'écrive sa propre règle de formatage :
 * une seule fonction à corriger si l'école change de devise ou de format
 * de date.
 */

/** Montant en francs CFA, séparateurs d'espaces, sans décimales. */
export function fmtXOF(amount: number): string {
  // toLocaleString('fr-FR') sépare les milliers par une espace fine
  // insécable (U+202F) ou une espace insécable ordinaire (U+00A0) selon le
  // moteur JS : on les remplace par un caractère construit à l'exécution
  // (String.fromCharCode), jamais écrit en dur dans le source — ESLint
  // refuse une espace irrégulière littérale, et ce serait de toute façon
  // invisible à la relecture.
  const oddSpaces = new RegExp(`[${String.fromCharCode(0x00a0)}${String.fromCharCode(0x202f)}]`, 'g');
  const grouped = Math.round(amount).toLocaleString('fr-FR').replace(oddSpaces, ' ');
  return `${grouped} FCFA`;
}

/** "2026-11-05" (input type="date") → "05/11/2026" (affichage). */
export function isoToFR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "05/11/2026" (affichage) → "2026-11-05" (input type="date", tri). */
export function frToISO(fr: string): string {
  if (!fr) return '';
  const [d, m, y] = fr.split('/');
  if (!y || !m || !d) return fr;
  return `${y}-${m}-${d}`;
}

/** Date du jour au format ISO, pour préremplir un input type="date". */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "Fatou Ndoye" → "FN" — pour les avatars. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** "2026-10" (input type="month") → "Octobre 2026". */
export function monthValueToFR(value: string): string {
  const [y, m] = value.split('-');
  const index = Number(m) - 1;
  const name = MONTHS_FR[index];
  return name ? `${name} ${y}` : value;
}

/** Taille de fichier lisible — "245 Ko", "1.3 Mo". */
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const ko = bytes / 1024;
  if (ko < 1024) return `${ko.toFixed(ko < 10 ? 1 : 0)} Ko`;
  const mo = ko / 1024;
  return `${mo.toFixed(mo < 10 ? 1 : 0)} Mo`;
}

/**
 * Nombre compact pour un repère d'axe de graphique — "850", "25 K", "1,2 M".
 * Jamais de devise ici (voir `fmtXOF`) : ceci habille un axe, pas une valeur lue isolément.
 */
export function fmtCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const value = abs / 1_000_000;
    return `${sign}${value.toFixed(Number.isInteger(value) ? 0 : 1).replace('.', ',')} M`;
  }
  if (abs >= 1_000) {
    const value = abs / 1_000;
    return `${sign}${value.toFixed(Number.isInteger(value) ? 0 : 1).replace('.', ',')} K`;
  }
  return `${sign}${Math.round(abs)}`;
}

const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

/**
 * Période renvoyée par l'historique du grand livre ("2026-10-05" en jour,
 * "2026-W41" en semaine, "2026-10" en mois, "2026" en année) → libellé court,
 * pour un axe de graphique sans le surcharger.
 */
export function periodLabelShort(period: string): string {
  const dayMatch = period.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayMatch) return `${dayMatch[3]}/${dayMatch[2]}`;
  const weekMatch = period.match(/^(\d{4})-W(\d{2})$/);
  if (weekMatch) return `S${weekMatch[2]}`;
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const index = Number(monthMatch[2]) - 1;
    const name = MONTHS_FR_SHORT[index];
    return name ? `${name} ${(monthMatch[1] ?? '').slice(2)}` : period;
  }
  return period; // année seule, ex. "2026"
}

/**
 * Même entrée que `periodLabelShort`, mais en libellé complet — pour
 * l'infobulle du graphique, la vue tableau et l'export Excel.
 */
export function periodLabelFull(period: string): string {
  const dayMatch = period.match(/^\d{4}-\d{2}-\d{2}$/);
  if (dayMatch) return isoToFR(period);
  const weekMatch = period.match(/^(\d{4})-W(\d{2})$/);
  if (weekMatch) return `Semaine ${weekMatch[2]} — ${weekMatch[1]}`;
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return monthValueToFR(`${monthMatch[1]}-${monthMatch[2]}`);
  return period; // année seule, ex. "2026"
}

/** "Aïssatou Ndiaye-Fall" → "aissatou-ndiaye-fall" — sans accent ni espace, sûr pour un nom de fichier. */
function slugifyNamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

/**
 * Nom de fichier pour un téléchargement PDF : `{type}_{prenom}_{nom}_{date}.pdf`.
 *
 * Volontairement construit à partir d'éléments lisibles (prénom/nom/date) et
 * JAMAIS de l'id technique du document : cet id se retrouverait tel quel
 * dans le nom de fichier téléchargé (historique du navigateur, captures
 * d'écran, email de transfert...), ce qui l'expose inutilement. Même
 * fonction que `apps/teacher`/`apps/director` (`buildDownloadFilename`).
 */
export function buildDownloadFilename(type: string, firstName: string, lastName: string, date?: string): string {
  const base = [type, slugifyNamePart(firstName), slugifyNamePart(lastName), date ?? todayISO()]
    .filter(Boolean)
    .join('_');
  return `${base}.pdf`;
}

/** Déclenche le téléchargement d'un blob dans le navigateur (lien temporaire). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Formate un pourcentage : au plus 2 décimales, sans zéros inutiles
 * (87.87878… → "87.88", 95 → "95", 87.5 → "87.5"). "—" si non fini.
 */
export function fmtPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return String(Math.round(value * 100) / 100);
}
