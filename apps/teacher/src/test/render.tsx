import type { ReactElement, ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Providers } from '@/app/providers';
import { createServiceDoubles } from '@/test/doubles';
import type { Services } from '@/services/ports';

/**
 * Rendu de test avec les mêmes fournisseurs que l'application.
 *
 * Les tentatives sont désactivées et le cache isolé par test : sans cela,
 * une requête en échec serait rejouée et un test polluerait le suivant.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: { services?: Partial<Services>; route?: string } = {},
): RenderResult {
  const services = createServiceDoubles(options.services);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[options.route ?? '/']}>
      <Providers servicesOverride={services} queryClientOverride={queryClient}>
        {children}
      </Providers>
    </MemoryRouter>
  );

  return render(ui, { wrapper });
}
