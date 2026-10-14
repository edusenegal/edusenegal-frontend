import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppRoutes } from '@/app/router';
import { useServices } from '@/hooks/useServices';
import { applyBranding } from '@/utils/branding';

/** Applique la couleur de marque de l'école dès que `getSchool()` répond. */
export function BrandingGate() {
  const { school } = useServices();
  const { data } = useQuery({ queryKey: ['school'], queryFn: () => school.getSchool() });

  useEffect(() => {
    if (data) applyBranding(data);
  }, [data]);

  return <AppRoutes />;
}
