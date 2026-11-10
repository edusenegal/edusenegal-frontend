/**
 * Arborescence de navigation de l'espace comptabilité.
 *
 * Un seul fichier décrit la barre latérale : `components/layout/Sidebar`
 * ne fait que le parcourir. Ajouter un écran ne touche que ce fichier et
 * `app/router.tsx`. Même convention que `apps/director`.
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
    label: 'Finances',
    items: [
      { to: '/', label: 'Tableau de bord', icon: '📊' },
      { to: '/depenses', label: 'Dépenses', icon: '💰' },
      { to: '/encaissements', label: 'Encaissements', icon: '💳' },
      { to: '/caisse', label: 'Caisse', icon: '🧾' },
      { to: '/grand-livre', label: 'Grand livre', icon: '📒' },
      { to: '/salaires', label: 'Salaires', icon: '💵' },
      { to: '/portefeuilles', label: 'Portefeuilles élèves', icon: '👛' },
      { to: '/paiements', label: 'Paiements', icon: '🧾' },
      { to: '/recouvrement', label: 'Recouvrement', icon: '📊' },
      { to: '/bourses', label: 'Bourses', icon: '🎓' },
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
  return 'EduSénégal';
}
