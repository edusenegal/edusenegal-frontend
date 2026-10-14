/**
 * Arborescence de navigation de l'espace direction.
 *
 * Un seul fichier décrit la barre latérale : `components/layout/Sidebar`
 * ne fait que le parcourir. Ajouter un écran ne touche que ce fichier et
 * `app/router.tsx`.
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
    label: 'Vue d’ensemble',
    items: [{ to: '/', label: 'Tableau de bord', icon: '📊' }],
  },
  {
    label: 'Pédagogie',
    items: [
      { to: '/classes', label: 'Classes', icon: '🏷️' },
      { to: '/enseignants', label: 'Enseignants', icon: '🧑‍🏫' },
      { to: '/eleves', label: 'Élèves', icon: '🎓' },
      { to: '/matieres', label: 'Matières', icon: '📘' },
      { to: '/resultats', label: 'Résultats & bulletins', icon: '🧮' },
      { to: '/promotions', label: 'Promotions', icon: '⬆️' },
      { to: '/transferts', label: 'Transferts', icon: '↔️' },
      { to: '/annee-scolaire', label: 'Année scolaire', icon: '📅' },
    ],
  },
  {
    label: 'Ressources humaines',
    items: [
      { to: '/conges', label: 'Congés & absences', icon: '🗒️' },
      { to: '/salaires', label: 'Demandes de salaire', icon: '💰' },
    ],
  },
  {
    label: 'Finances',
    items: [{ to: '/paiements', label: 'Paiements', icon: '💳' }],
  },
  {
    label: 'Documents & communication',
    items: [
      { to: '/signatures', label: 'Bulletins & signatures', icon: '✍️' },
      { to: '/notes-de-service', label: 'Notes de service', icon: '📣' },
    ],
  },
  {
    label: 'Établissement',
    items: [{ to: '/parametres', label: 'Paramètres', icon: '⚙️' }],
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
