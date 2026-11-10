import type { CSSProperties } from 'react';
import './Logo.css';

export type LogoRole =
  | 'director' | 'teacher' | 'accountant'
  | 'supervisor' | 'librarian' | 'student' | 'parent';

/** Couleur de marque par profil (validée). Le logo s'habille de cette teinte. */
export const ROLE_COLOR: Record<LogoRole, string> = {
  director: '#4f46e5',
  teacher: '#0e9f6e',
  accountant: '#b45309',
  supervisor: '#2563eb',
  librarian: '#7c3aed',
  student: '#e2574c',
  parent: '#15803d',
};

export interface LogoProps {
  /** Profil → couleur. Omis : hérite de currentColor. */
  role?: LogoRole;
  /** horizontal (défaut) | stacked | mark (symbole seul) | icon (tuile). */
  variant?: 'horizontal' | 'stacked' | 'mark' | 'icon';
  /** Colore tout le mot (sinon seul le É porte la couleur). */
  full?: boolean;
  /** Taille du symbole : nombre (px) ou longueur CSS libre (ex. "clamp(28px,6vw,48px)"). */
  size?: number | string;
  /** Taille fluide selon l'écran (dérive un clamp() à partir de `size`, pris comme maximum). */
  responsive?: boolean;
  /** Force une couleur (ex. charte d'école) à la place du rôle. */
  color?: string;
  title?: string;
  className?: string;
}

/** Convertit `size` en longueur CSS. En mode responsive, dérive un clamp() :
 *  ~0.72× sur petit écran, jusqu'à `size` en grand. */
function toLen(size: number | string, responsive: boolean): string {
  if (typeof size === 'string') return size;
  if (!responsive) return `${size}px`;
  const min = Math.round(size * 0.72);
  const pref = Math.round(size * 0.55);
  return `clamp(${min}px, ${pref}px + 1.4vw, ${size}px)`;
}

function Mark({ len, color }: { len: string; color: string }) {
  return (
    <svg className="edu-logo__mark" viewBox="0 0 72 72" aria-hidden="true" style={{ color, width: len, height: len }}>
      <polygon fill="currentColor" points="36,13 59,23 36,33 13,23" />
      <path fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M25 29 v5 q0 4 11 4 q11 0 11 -4 v-5" />
      <path fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" d="M19 57 v-9 a6 6 0 0 1 12 0 v9 M30.5 57 v-9 a6 6 0 0 1 12 0 v9 M42 57 v-9 a6 6 0 0 1 12 0 v9" />
      <line x1="15" y1="57" x2="58" y2="57" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  role, variant = 'horizontal', full = false, size = 32, responsive = false,
  color, title = 'SénÉtude', className = '',
}: LogoProps) {
  const accent = color ?? (role ? ROLE_COLOR[role] : 'currentColor');
  const len = toLen(size, responsive);

  if (variant === 'mark') {
    return <span className={`edu-logo ${className}`.trim()} role="img" aria-label={title}><Mark len={len} color={accent} /></span>;
  }

  if (variant === 'icon') {
    return (
      <span
        className={`edu-logo edu-logo--icon ${className}`.trim()}
        role="img"
        aria-label={title}
        style={{ background: accent, width: len, height: len, borderRadius: `calc(${len} * 0.24)` }}
      >
        <Mark len={`calc(${len} * 0.62)`} color="#ffffff" />
      </span>
    );
  }

  return (
    <span
      className={`edu-logo edu-logo--${variant} ${className}`.trim()}
      role="img"
      aria-label={title}
      style={{ '--edu-logo-size': len } as CSSProperties}
    >
      <Mark len={len} color={accent} />
      <span className="edu-logo__word" style={full ? { color: accent } : undefined}>
        Sén<i style={{ color: accent }}>É</i>tude
      </span>
    </span>
  );
}

export default Logo;
