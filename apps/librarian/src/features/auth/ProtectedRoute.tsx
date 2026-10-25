import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { StateView } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Deux rôles (TEACHER, INSTITUTEUR) partagent cette application — déjà
 * filtrés à la connexion (voir `auth.api.ts#fetchTeacherProfile`) : cette
 * garde ne vérifie donc que la présence d'une session, pas un rôle précis.
 *
 * `idle`/`authenticating` : la restauration silencieuse de la session
 * (`AuthProvider`) est en cours.
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
