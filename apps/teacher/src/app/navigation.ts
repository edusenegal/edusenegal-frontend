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
      { to: '/', label: 'Tableau de bord', icon: '📊' },
      { to: '/emploi-du-temps', label: 'Emploi du temps', icon: '🗓️' },
      { to: '/mes-classes', label: 'Mes classes', icon: '🏷️' },
    ],
  },
  {
    label: 'Pédagogie',
    items: [
      { to: '/appel', label: 'Appel', icon: '✅' },
      { to: '/notes/saisie', label: 'Saisie des notes', icon: '✏️' },
      { to: '/notes/classe', label: 'Notes d’une classe', icon: '📋' },
      { to: '/reclamations-notes', label: 'Réclamations de notes', icon: '📮' },
      { to: '/resultats', label: 'Résultats & bulletins', icon: '🧮' },
      { to: '/examens', label: 'Devoirs & examens', icon: '📝' },
      { to: '/documents', label: 'Cours & ressources', icon: '📘' },
      { to: '/quiz', label: 'Quiz IA', icon: '🤖' },
    ],
  },
  {
    label: 'Vie professionnelle',
    items: [
      { to: '/conges', label: 'Congés', icon: '🗒️' },
      { to: '/paie', label: 'Ma fiche de paie', icon: '💰' },
      { to: '/mes-documents', label: 'Mes documents', icon: '🪪' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { to: '/messagerie', label: 'Messagerie', icon: '💬' },
      { to: '/notifications', label: 'Notifications', icon: '🔔' },
      { to: '/reclamations', label: 'Réclamations & suggestions', icon: '📣' },
    ],
  },
  {
    label: 'Compte',
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
