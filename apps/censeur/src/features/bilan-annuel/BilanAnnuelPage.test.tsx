import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import type { BilanAnnuel } from '@/types/domain';
import BilanAnnuelPage from './BilanAnnuelPage';

const BILAN: BilanAnnuel = {
  anneeActuelle: '2026-2027',
  anneePrecedente: '2025-2026',
  effectif: { valeurActuelle: 320, valeurPrecedente: 298, variationPct: 7.4 },
  recettes: { valeurActuelle: 42_300_000, valeurPrecedente: 38_900_000, variationPct: 8.7 },
  depenses: { valeurActuelle: 23_850_000, valeurPrecedente: 25_100_000, variationPct: -5 },
  solde: { valeurActuelle: 18_450_000, valeurPrecedente: 13_800_000, variationPct: 33.7 },
  tauxReussite: { valeurActuelle: 78.5, valeurPrecedente: 74.2, variationPct: 5.8 },
  tauxPresence: { valeurActuelle: 93.1, valeurPrecedente: 91.6, variationPct: 1.6 },
};

describe('BilanAnnuelPage', () => {
  it('affiche les indicateurs comparés à l’année précédente (hors recettes/dépenses)', async () => {
    renderWithProviders(<BilanAnnuelPage />, {
      services: { bilanAnnuel: { getBilan: vi.fn().mockResolvedValue(BILAN) } },
    });

    await waitFor(() => expect(screen.getByText('320')).toBeInTheDocument());
    expect(screen.getByText('78.5%')).toBeInTheDocument();
    expect(screen.getByText('93.1%')).toBeInTheDocument();
    expect(screen.getByText('+5.8% vs année précédente (points)')).toBeInTheDocument();
    expect(screen.getByText('+1.6% vs année précédente (points)')).toBeInTheDocument();
    expect(screen.queryByText('Recettes')).not.toBeInTheDocument();
    expect(screen.queryByText('Dépenses')).not.toBeInTheDocument();
  });

  it('n’affiche aucune variation quand il n’y a pas d’année précédente', async () => {
    const SEULE: BilanAnnuel = {
      ...BILAN,
      anneePrecedente: null,
      effectif: { valeurActuelle: 45, valeurPrecedente: null, variationPct: null },
    };
    renderWithProviders(<BilanAnnuelPage />, {
      services: { bilanAnnuel: { getBilan: vi.fn().mockResolvedValue(SEULE) } },
    });

    await waitFor(() => expect(screen.getByText('45')).toBeInTheDocument());
    expect(screen.getByText(/pas encore d.année précédente/)).toBeInTheDocument();
  });
});
