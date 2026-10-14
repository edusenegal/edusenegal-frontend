import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import type { DashboardSnapshot } from '@/types/domain';
import DashboardPage from './DashboardPage';

const SNAPSHOT: DashboardSnapshot = {
  effectifTotal: 312,
  effectifGarcons: 160,
  effectifFilles: 152,
  presenceDuJour: 94,
  soldeCaisse: 18_450_000,
  demandesEnAttente: 3,
  classesCount: 8,
  enseignantsCount: 10,
};

describe('DashboardPage', () => {
  it('affiche les indicateurs une fois les données chargées', async () => {
    renderWithProviders(<DashboardPage />, {
      services: {
        dashboard: { getSnapshot: vi.fn().mockResolvedValue(SNAPSHOT) },
        classes: { list: vi.fn().mockResolvedValue([]) } as never,
        leaves: { list: vi.fn().mockResolvedValue([]) } as never,
        salaryRequests: { list: vi.fn().mockResolvedValue([]) } as never,
      },
    });

    await waitFor(() => expect(screen.getByText('312')).toBeInTheDocument());
    expect(screen.getByText('94%')).toBeInTheDocument();
  });
});
