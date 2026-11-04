/**
 * Libellés français des rôles (valeurs backend user-service) — source unique
 * de vérité partagée par l'espace Personnel et les notes de service, pour ne
 * jamais afficher un rôle en anglais à l'utilisateur.
 */
export const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: 'Directeur',
  SUPER_ADMIN: 'Super administrateur',
  TEACHER: 'Enseignant',
  INSTITUTEUR: 'Instituteur',
  CENSEUR: 'Censeur',
  SUPERVISOR: 'Surveillant général',
  ACCOUNTANT: 'Comptable',
  LIBRARIAN: 'Bibliothécaire',
  SECRETARY_GENERAL: 'Secrétaire général',
  SECRETARY: 'Secrétaire',
  REGISTRAR: 'Scolarité / Inscriptions',
  HR_DIRECTOR: 'Directeur RH',
  FINANCE_DIRECTOR: 'Directeur financier',
  IT_MANAGER: 'Responsable informatique',
  CANTEEN_STAFF: 'Personnel de cantine',
  VICE_RECTOR: 'Vice-recteur',
  DEAN: 'Doyen',
  DEPARTMENT_HEAD: 'Chef de département',
  LAB_DIRECTOR: 'Directeur de laboratoire',
  BOARD_MEMBER: 'Membre du conseil',
  PARENT: 'Parent',
  GUARDIAN: 'Tuteur',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABELS[role] ?? role;
}
