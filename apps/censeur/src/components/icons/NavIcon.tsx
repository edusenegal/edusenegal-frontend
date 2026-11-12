import type { ReactNode } from 'react';

/**
 * Icônes de navigation — jeu interne de pictogrammes au trait (24×24,
 * `currentColor`), remplaçant les emojis de la barre latérale. Zéro
 * dépendance : chaque icône est un ou plusieurs chemins SVG.
 *
 * `navigation.ts` référence les icônes par NOM (`icon: 'dashboard'`) ;
 * un nom inconnu tombe sur un point neutre plutôt que de casser le rendu.
 */

const PATHS: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </>
  ),
  'trending-up': (
    <>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </>
  ),
  tag: (
    <>
      <path d="M11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.8 8.8a2 2 0 0 0 2.8 0l6.2-6.2a2 2 0 0 0 0-2.8L13.6 2.6A2 2 0 0 0 11.2 2z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>
  ),
  'user-square': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.7 20.2c.9-2.4 3-3.9 5.3-3.9s4.4 1.5 5.3 3.9" />
    </>
  ),
  graduation: (
    <>
      <path d="M22 9 12 4 2 9l10 5 10-5z" />
      <path d="M6 11.8V16c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4.2" />
      <path d="M22 9v5" />
    </>
  ),
  'calendar-check': (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
      <path d="m9 14.5 2 2 4-4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.3C10.6 4.9 8.6 4.2 6.3 4.2c-1.2 0-2.3.2-3.3.6v13.9c1-.4 2.1-.6 3.3-.6 2.3 0 4.3.7 5.7 2.1 1.4-1.4 3.4-2.1 5.7-2.1 1.2 0 2.3.2 3.3.6V4.8c-1-.4-2.1-.6-3.3-.6-2.3 0-4.3.7-5.7 2.1z" />
      <path d="M12 6.3v13.9" />
    </>
  ),
  building: (
    <>
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M3 21h18" />
      <path d="M9.5 7h1.6M13 7h1.6M9.5 11h1.6M13 11h1.6" />
      <path d="M10.5 21v-3.5h3V21" />
    </>
  ),
  calculator: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M8.5 7.5h7" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01M8.5 19h.01M12 19h.01M15.5 19h.01" />
    </>
  ),
  inbox: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  'arrow-up-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 3.5-3.5 3.5 3.5" />
      <path d="M12 9.5V16" />
    </>
  ),
  transfer: (
    <>
      <path d="m16 3 4 4-4 4" />
      <path d="M20 7H4" />
      <path d="m8 21-4-4 4-4" />
      <path d="M4 17h16" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20.5c.6-3.1 3.2-5 6.5-5s5.9 1.9 6.5 5" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6" />
      <path d="M17.8 15.9c2 .8 3.4 2.4 3.7 4.6" />
    </>
  ),
  clipboard: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  banknote: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 12h.01M17.5 12h.01" />
    </>
  ),
  'credit-card': (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M6 15h4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.2" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v18l-2.3-1.6-2.3 1.6-2.4-1.6L9.6 21l-2.3-1.6L5 21V3z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  pen: (
    <>
      <path d="M17.5 2.9a2.12 2.12 0 0 1 3 3L8 18.4 3 20l1.6-5L17.5 2.9z" />
      <path d="m14.5 5.9 3.6 3.6" />
    </>
  ),
  megaphone: (
    <>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="14.5" cy="7" r="2.5" />
      <path d="M3 7h8.6M17.9 7H21" />
      <circle cx="9" cy="17" r="2.5" />
      <path d="M3 17h2.6M12.4 17H21" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.3 12.3 2.4 2.4 4.9-5.2" />
    </>
  ),
  edit: (
    <>
      <path d="M12 3.5H5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h13.5a2 2 0 0 0 2-2v-7" />
      <path d="M18.4 2.6a2.12 2.12 0 0 1 3 3L13 14l-4 1 1-4 8.4-8.4z" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </>
  ),
  'file-text': (
    <>
      <path d="M14.5 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-4.5-4.5z" />
      <path d="M14.5 2.5V7H19" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="m19 15 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
    </>
  ),
  'id-card': (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <circle cx="8" cy="11" r="2" />
      <path d="M5 16.5c.5-1.6 1.6-2.5 3-2.5s2.5.9 3 2.5" />
      <path d="M14.5 9.5H19M14.5 13H19" />
    </>
  ),
  message: (
    <>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.3 0-2.5-.3-3.6-.8L3 21l1.8-5.9A8.5 8.5 0 1 1 21 11.5z" />
    </>
  ),
  bell: (
    <>
      <path d="M18.5 9a6.5 6.5 0 1 0-13 0c0 5.5-2.2 7-2.2 7h17.4s-2.2-1.5-2.2-7" />
      <path d="M10.2 20a2.1 2.1 0 0 0 3.6 0" />
    </>
  ),
  archive: (
    <>
      <rect x="2.5" y="4" width="19" height="5" rx="1.5" />
      <path d="M4.5 9v9.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9" />
      <path d="M10 13.5h4" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M16 7V5.5A1.5 1.5 0 0 0 14.5 4h-9A2.5 2.5 0 0 0 3 6.5V9" />
      <path d="M17 13h.01" />
    </>
  ),
  coins: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M15.8 9.2a5.5 5.5 0 1 1-6.6 6.6" />
      <path d="M7 6h1v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 1.9" />
    </>
  ),
  bookmark: (
    <>
      <path d="m18 21-6-4-6 4V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16z" />
    </>
  ),
  library: (
    <>
      <path d="M4 4v16" />
      <path d="M8 8v12" />
      <path d="M12 6v14" />
      <path d="m16 6 4 14" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20.5c.8-3.5 3.8-5.5 7.5-5.5s6.7 2 7.5 5.5" />
    </>
  ),
};

interface NavIconProps {
  name: string;
  size?: number;
}

export function NavIcon({ name, size = 18 }: NavIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      {PATHS[name] ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}
