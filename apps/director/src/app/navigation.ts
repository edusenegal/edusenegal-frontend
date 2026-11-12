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
    items: [
      { to: '/', label: 'Tableau de bord', icon: 'dashboard' },
      { to: '/bilan-annuel', label: 'Bilan annuel', icon: 'trending-up' },
    ],
  },
  {
    label: 'Pédagogie',
    items: [
      { to: '/classes', label: 'Classes', icon: 'tag' },
      { to: '/enseignants', label: 'Enseignants', icon: 'user-square' },
      { to: '/eleves', label: 'Élèves', icon: 'graduation' },
      { to: '/presence', label: 'Présence & absences', icon: 'calendar-check' },
      { to: '/matieres', label: 'Matières', icon: 'book' },
      { to: '/salles', label: 'Salles de classe', icon: 'building' },
      { to: '/resultats', label: 'Résultats & bulletins', icon: 'calculator' },
      { to: '/reclamations-notes', label: 'Réclamations de notes', icon: 'inbox' },
      { to: '/promotions', label: 'Promotions', icon: 'arrow-up-circle' },
      { to: '/transferts', label: 'Transferts', icon: 'transfer' },
      { to: '/annee-scolaire', label: 'Année scolaire', icon: 'calendar' },
    ],
  },
  {
    label: 'Ressources humaines',
    items: [
      { to: '/personnel', label: 'Personnel', icon: 'users' },
      { to: '/conges', label: 'Congés & absences', icon: 'clipboard' },
      { to: '/salaires', label: 'Demandes de salaire', icon: 'banknote' },
    ],
  },
  {
    label: 'Finances',
    items: [
      { to: '/paiements', label: 'Paiements', icon: 'credit-card' },
      { to: '/recouvrement', label: 'Recouvrement', icon: 'target' },
      { to: '/depenses', label: 'Dépenses', icon: 'receipt' },
    ],
  },
  {
    label: 'Documents & communication',
    items: [
      { to: '/signatures', label: 'Bulletins & signatures', icon: 'pen' },
      { to: '/notes-de-service', label: 'Notes de service', icon: 'megaphone' },
    ],
  },
  {
    label: 'Établissement',
    items: [{ to: '/parametres', label: 'Paramètres', icon: 'settings' }],
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
