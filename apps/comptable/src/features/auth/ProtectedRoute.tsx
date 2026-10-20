import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { StateView } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Un seul rôle est censé arriver jusqu'ici (ACCOUNTANT) : cette garde ne
 * vérifie donc que la présence d'une session, pas un rôle — le vrai
 * filtrage par rôle se fait désormais à la connexion elle-même (voir
 * `fetchAccountantProfile` dans `auth.api.ts`, qui refuse tout compte dont
 * le rôle backend n'est pas ACCOUNTANT avant même d'ouvrir l'application).
 *
 * `idle`/`authenticating` : la restauration silencieuse de la session
 * (`AuthProvider`) est en cours — ni l'écran protégé ni la connexion ne
 * s'affichent tant qu'elle n'a pas conclu, sans quoi un rechargement de
 * page ferait clignoter l'écran de connexion avant de revenir au tableau
 * de bord.
 */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'idle' || status === 'authenticating') {
    return <StateView loading />;
  }

  if (status === 'anonymous') {
    return <Navigate to="/connexion" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
