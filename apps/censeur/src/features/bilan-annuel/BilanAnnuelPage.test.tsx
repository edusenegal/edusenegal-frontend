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
  moyenneGenerale: { valeurActuelle: 12.4, valeurPrecedente: 11.8, variationPct: 5.1 },
  mentions: 34,
  tauxRetard: 4.1,
  reussiteParNiveau: [
    { niveau: '2nde', taux: 82, effectif: 150 },
    { niveau: '1ère', taux: 85, effectif: 140 },
    { niveau: 'Tle', taux: 71, effectif: 130 },
  ],
  presence: { present: 18420, absent: 1760, retard: 860 },
};

describe('BilanAnnuelPage', () => {
  it('affiche les indicateurs et la comparaison à l’année précédente', async () => {
    renderWithProviders(<BilanAnnuelPage />, {
      services: { bilanAnnuel: { getBilan: vi.fn().mockResolvedValue(BILAN) } },
    });

    await waitFor(() => expect(screen.getByText(/comparée à 2025-2026/)).toBeInTheDocument());
    // effectif (apparaît dans la tuile KPI et la scorecard Vie scolaire)
    expect(screen.getAllByText('320').length).toBeGreaterThanOrEqual(1);
    // réussite par niveau
    expect(screen.getByText('2nde')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    // au moins une variation affichée
    expect(screen.getAllByText(/\+7\.4%|\+5\.8%|\+8\.7%/).length).toBeGreaterThanOrEqual(1);
  });

  it('n’affiche aucune variation quand il n’y a pas d’année précédente', async () => {
    const SEULE: BilanAnnuel = {
      ...BILAN,
      anneePrecedente: null,
      effectif: { valeurActuelle: 45, valeurPrecedente: null, variationPct: null },
      recettes: { ...BILAN.recettes, valeurPrecedente: null, variationPct: null },
      depenses: { ...BILAN.depenses, valeurPrecedente: null, variationPct: null },
      solde: { ...BILAN.solde, valeurPrecedente: null, variationPct: null },
      tauxReussite: { ...BILAN.tauxReussite, valeurPrecedente: null, variationPct: null },
      tauxPresence: { ...BILAN.tauxPresence, valeurPrecedente: null, variationPct: null },
      moyenneGenerale: { ...BILAN.moyenneGenerale, valeurPrecedente: null, variationPct: null },
    };
    renderWithProviders(<BilanAnnuelPage />, {
      services: { bilanAnnuel: { getBilan: vi.fn().mockResolvedValue(SEULE) } },
    });

    await waitFor(() => expect(screen.getByText(/pas encore d.année précédente/)).toBeInTheDocument());
    expect(screen.getAllByText(/1.* année/).length).toBeGreaterThanOrEqual(1);
  });
});
