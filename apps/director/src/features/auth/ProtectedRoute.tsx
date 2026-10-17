import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { StateView } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Un seul rôle existe dans cette application (DIRECTOR) : cette garde ne
 * vérifie donc que la présence d'une session, pas un rôle. Si l'espace
 * direction est un jour servi aux côtés d'autres rôles (comptable,
 * enseignant…) derrière la même session, c'est ici qu'une vérification de
 * rôle s'ajouterait — à l'image de `student/web`.
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
