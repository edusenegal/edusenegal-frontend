import { useState, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createQueryClient } from '@/app/query-client';
import { ServicesContext } from '@/hooks/useServices';
import { services } from '@/services';
import type { Services } from '@/services/ports';

interface ProvidersProps {
  children: ReactNode;
  /** Les tests injectent des doubles ici, sans toucher `src/services`. */
  servicesOverride?: Services;
  queryClientOverride?: QueryClient;
}

export function Providers({ children, servicesOverride, queryClientOverride }: ProvidersProps) {
  const [queryClient] = useState(() => queryClientOverride ?? createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ServicesContext.Provider value={servicesOverride ?? services}>{children}</ServicesContext.Provider>
    </QueryClientProvider>
  );
}
