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
