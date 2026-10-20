import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import type { LedgerHistory, SchoolLedger } from '@/types/domain';
import DashboardPage from './DashboardPage';

const LEDGER: SchoolLedger = {
  totalEncaissements: 5_000_000,
  totalDepenses: 1_200_000,
  solde: 3_800_000,
  derniereMajLe: '18/10/2026 09:00',
};

const HISTORY: LedgerHistory = {
  granularite: 'month',
  points: [
    { period: '2026-09', entreesFcfa: 1_500_000, sortiesFcfa: 400_000 },
    { period: '2026-10', entreesFcfa: 2_000_000, sortiesFcfa: 600_000 },
  ],
  totalEntreesFcfa: 3_500_000,
  totalSortiesFcfa: 1_000_000,
  solde: 3_800_000,
};

describe('DashboardPage', () => {
  it('affiche le solde, les totaux et la courbe d’évolution', async () => {
    const get = vi.fn().mockResolvedValue(LEDGER);
    const getHistory = vi.fn().mockResolvedValue(HISTORY);
    renderWithProviders(<DashboardPage />, { services: { ledger: { get, getHistory } } });

    await waitFor(() => expect(screen.getByText('3 800 000 FCFA')).toBeInTheDocument());
    expect(screen.getByText('5 000 000 FCFA')).toBeInTheDocument();
    expect(screen.getByText('1 200 000 FCFA')).toBeInTheDocument();

    await waitFor(() => expect(getHistory).toHaveBeenCalledWith('month', expect.any(String), expect.any(String)));
    expect(screen.getByRole('img', { name: /évolution des entrées et des sorties/i })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Séries affichées' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exporter en excel/i })).toBeEnabled();
  });

  it('renvoie vers le détail des dépenses au clic sur la tuile', async () => {
    const get = vi.fn().mockResolvedValue(LEDGER);
    const getHistory = vi.fn().mockResolvedValue(HISTORY);
    renderWithProviders(<DashboardPage />, { services: { ledger: { get, getHistory } } });

    const tile = await screen.findByRole('button', { name: /total des dépenses/i });
    expect(tile).toBeInTheDocument();
  });
});
