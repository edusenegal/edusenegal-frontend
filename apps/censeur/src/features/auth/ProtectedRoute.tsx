import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { StateView } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Deux rôles existent dans cette application (SUPERVISOR, CENSEUR — même
 * métier, nommé différemment selon le type d'école) : cette garde ne
 * vérifie donc que la présence d'une session, pas un rôle précis — le rôle
 * lui-même est déjà vérifié par `fetchDirectorProfile` (403 sinon) avant
 * que la session ne soit posée.
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
