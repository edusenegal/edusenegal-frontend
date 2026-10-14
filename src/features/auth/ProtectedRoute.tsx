import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Un seul rôle existe dans cette application (DIRECTOR) : cette garde ne
 * vérifie donc que la présence d'une session, pas un rôle. Si l'espace
 * direction est un jour servi aux côtés d'autres rôles (comptable,
 * enseignant…) derrière la même session, c'est ici qu'une vérification de
 * rôle s'ajouterait — à l'image de `student/web`.
 */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'anonymous') {
    return <Navigate to="/connexion" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
