import { createContext, useContext } from 'react';
import type { Services } from '@/services/ports';

/**
 * Injection de dépendances minimale.
 *
 * Les écrans reçoivent les services par ce contexte plutôt que par import
 * direct : les tests fournissent des doubles sans toucher au module, et
 * une future bascule entre la branche `mock` et une branche `api` se
 * limiterait au fournisseur, à la racine (`src/app/providers.tsx`).
 */
export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error('useServices doit être utilisé à l’intérieur de <Providers>.');
  }
  return services;
}
