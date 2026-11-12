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
      { to: '/', label: 'Tableau de bord', icon: 'dashboard' },
      { to: '/depenses', label: 'Dépenses', icon: 'receipt' },
      { to: '/encaissements', label: 'Encaissements', icon: 'credit-card' },
      { to: '/caisse', label: 'Caisse', icon: 'archive' },
      { to: '/grand-livre', label: 'Grand livre', icon: 'book' },
      { to: '/salaires', label: 'Salaires', icon: 'banknote' },
      { to: '/portefeuilles', label: 'Portefeuilles élèves', icon: 'wallet' },
      { to: '/paiements', label: 'Paiements', icon: 'coins' },
      { to: '/recouvrement', label: 'Recouvrement', icon: 'target' },
      { to: '/bourses', label: 'Bourses', icon: 'graduation' },
      { to: '/profil', label: 'Mon profil', icon: 'user' },
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
