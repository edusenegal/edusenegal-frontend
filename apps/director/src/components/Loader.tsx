import type { CSSProperties } from 'react';
import './Loader.css';

export type LoaderRole =
  | 'director' | 'teacher' | 'accountant'
  | 'supervisor' | 'librarian' | 'student' | 'parent';

const ANIM: Record<LoaderRole, string> = {
  director: 'trail',
  teacher: 'eq',
  accountant: 'coins',
  supervisor: 'radar',
  librarian: 'pages',
  student: 'toss',
  parent: 'sprout',
};

export interface LoaderProps {
  /** Rôle → animation. director=parcours, teacher=équaliseur, accountant=caisse,
   *  supervisor=radar, librarian=pages, student=toque, parent=pousse. */
  role?: LoaderRole;
  /** Facteur de taille (1 = défaut). */
  size?: number;
  /** Écran de chargement plein écran, centré, avec message. */
  fullscreen?: boolean;
  /** Message affiché sous le loader en plein écran. */
  label?: string;
  className?: string;
}

function Shape({ anim }: { anim: string }) {
  switch (anim) {
    case 'trail':
      return (
        <div className="edu-l edu-trail">
          <span className="track" /><span className="fill" /><i /><i /><i /><i />
        </div>
      );
    case 'coins':
      return <div className="edu-l edu-coins"><i /><i /><i /><i /></div>;
    case 'radar':
      return <div className="edu-l edu-radar"><span className="sweep" /><span className="blip" /></div>;
    case 'pages':
      return (
        <div className="edu-l edu-pages">
          <span className="cover" /><span className="leaf" /><span className="leaf" /><span className="leaf" />
        </div>
      );
    case 'toss':
      return (
        <div className="edu-l edu-toss">
          <svg viewBox="0 0 60 40" width="56" height="38" aria-hidden="true">
            <polygon points="30,3 57,14 30,25 3,14" fill="currentColor" />
            <path d="M14 19 v7 q0 5 16 5 q16 0 16 -5 v-7 l-16 6 z" fill="currentColor" opacity={0.6} />
            <line x1="57" y1="14" x2="57" y2="30" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="57" cy="32" r="2.8" fill="currentColor" />
          </svg>
        </div>
      );
    case 'sprout':
      return (
        <div className="edu-l edu-sprout">
          <svg viewBox="0 0 48 56" width="52" height="60" aria-hidden="true">
            <path className="stem" d="M24 54 V20" />
            <ellipse className="leaf l" cx="15" cy="24" rx="9" ry="5.5" />
            <ellipse className="leaf r" cx="33" cy="20" rx="9" ry="5.5" />
          </svg>
        </div>
      );
    case 'eq':
    default:
      return <div className="edu-l edu-eq"><i /><i /><i /><i /><i /></div>;
  }
}

export function Loader({
  role = 'teacher',
  size = 1,
  fullscreen = false,
  label = 'Chargement…',
  className = '',
}: LoaderProps) {
  const anim = ANIM[role] ?? 'eq';

  if (fullscreen) {
    return (
      <div className={`edu-loader edu-loader--full ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
        <span className="edu-box" style={{ '--edu-scale': size * 1.7 } as CSSProperties}>
          <Shape anim={anim} />
        </span>
        {label ? <p className="edu-loader__label">{label}</p> : null}
      </div>
    );
  }

  return (
    <span className={`edu-loader ${className}`.trim()} role="status" aria-label={label} style={{ '--edu-scale': size } as CSSProperties}>
      <span className="edu-box"><Shape anim={anim} /></span>
    </span>
  );
}

export default Loader;
