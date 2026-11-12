import { useEffect, useState } from 'react';
import { getThemePreference, onThemeChange, setThemePreference, type ThemePreference } from '@/utils/theme';
import styles from './ThemeToggle.module.css';

const ORDER: ThemePreference[] = ['light', 'dark', 'system'];
const LABEL: Record<ThemePreference, string> = { light: 'Clair', dark: 'Sombre', system: 'Système' };

function Icon({ pref }: { pref: ThemePreference }) {
  if (pref === 'light')
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  if (pref === 'dark')
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

/**
 * Bascule de thème (clair → sombre → système). Un seul bouton compact, avec
 * libellé accessible ; la préférence est persistée (voir `utils/theme`).
 */
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [pref, setPref] = useState<ThemePreference>(() => getThemePreference());
  useEffect(() => onThemeChange(setPref), []);

  function next() {
    const i = ORDER.indexOf(pref);
    setThemePreference(ORDER[(i + 1) % ORDER.length] ?? 'system');
  }

  return (
    <button type="button" className={styles.btn} onClick={next} aria-label={`Thème : ${LABEL[pref]} — changer`} title={`Thème : ${LABEL[pref]}`}>
      <Icon pref={pref} />
      {withLabel ? <span>{LABEL[pref]}</span> : null}
    </button>
  );
}
