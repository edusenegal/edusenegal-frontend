import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppRoutes } from '@/app/router';
import { useServices } from '@/hooks/useServices';
import { useAuthStore } from '@/stores/auth.store';
import { applyBranding } from '@/utils/branding';

/**
 * Applique la couleur de marque de l'école dès que `getSchool()` répond.
 *
 * `enabled` sur le statut d'authentification : sur la branche `api`,
 * `getSchool()` exige une session (l'établissement vient du jeton) — un
 * appel tenté depuis l'écran de connexion échouerait toujours en 401.
 */
export function BrandingGate() {
  const { school } = useServices();
  const status = useAuthStore((s) => s.status);
  const { data } = useQuery({
    queryKey: ['school'],
    queryFn: () => school.getSchool(),
    enabled: status === 'authenticated',
  });

  useEffect(() => {
    if (data) applyBranding(data);
  }, [data]);

  return <AppRoutes />;
}
