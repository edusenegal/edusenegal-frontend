/**
 * Arborescence de navigation de l'espace bibliothécaire. La barre latérale
 * (`components/layout/Sidebar`) ne fait que parcourir ces groupes. Ajouter un
 * écran ne touche que ce fichier et `app/router.tsx`.
 */
export interface NavItem {
  to: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Bibliothèque',
    items: [
      { to: '/', label: 'Tableau de bord', icon: '📊' },
      { to: '/catalogue', label: 'Catalogue', icon: '📚' },
      { to: '/emprunts', label: 'Emprunts', icon: '🔄' },
      { to: '/retards', label: 'Retards', icon: '⏰' },
      { to: '/reservations', label: 'Réservations', icon: '🔖' },
      { to: '/adherents', label: 'Adhérents', icon: '👥' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/politique', label: 'Politique de prêt', icon: '⚙️' },
      { to: '/profil', label: 'Mon profil', icon: '👤' },
    ],
  },
];

export function labelForPath(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.to === pathname || (item.to !== '/' && pathname.startsWith(item.to))) {
        return item.label;
      }
    }
  }
  return 'Bibliothèque';
}
