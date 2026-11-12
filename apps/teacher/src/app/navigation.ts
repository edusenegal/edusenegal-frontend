/**
 * Arborescence de navigation de l'espace enseignant.
 *
 * Un seul fichier décrit la barre latérale : `components/layout/Sidebar`
 * ne fait que le parcourir. Ajouter un écran ne touche que ce fichier et
 * `app/router.tsx` — même convention que `apps/director`.
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
    label: 'Mon espace',
    items: [
      { to: '/', label: 'Tableau de bord', icon: 'dashboard' },
      { to: '/emploi-du-temps', label: 'Emploi du temps', icon: 'calendar' },
      { to: '/mes-classes', label: 'Mes classes', icon: 'tag' },
    ],
  },
  {
    label: 'Pédagogie',
    items: [
      { to: '/appel', label: 'Appel', icon: 'check-circle' },
      { to: '/notes/saisie', label: 'Saisie des notes', icon: 'edit' },
      { to: '/notes/classe', label: 'Notes d’une classe', icon: 'list' },
      { to: '/reclamations-notes', label: 'Réclamations de notes', icon: 'inbox' },
      { to: '/resultats', label: 'Résultats & bulletins', icon: 'calculator' },
      { to: '/examens', label: 'Devoirs & examens', icon: 'file-text' },
      { to: '/documents', label: 'Cours & ressources', icon: 'book' },
      { to: '/quiz', label: 'Quiz IA', icon: 'sparkles' },
    ],
  },
  {
    label: 'Vie professionnelle',
    items: [
      { to: '/conges', label: 'Congés', icon: 'clipboard' },
      { to: '/paie', label: 'Ma fiche de paie', icon: 'banknote' },
      { to: '/mes-documents', label: 'Mes documents', icon: 'id-card' },
      { to: '/documents-signes', label: 'Documents signés', icon: 'pen' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { to: '/messagerie', label: 'Messagerie', icon: 'message' },
      { to: '/notifications', label: 'Notifications', icon: 'bell' },
      { to: '/reclamations', label: 'Réclamations & suggestions', icon: 'megaphone' },
    ],
  },
  {
    label: 'Compte',
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
