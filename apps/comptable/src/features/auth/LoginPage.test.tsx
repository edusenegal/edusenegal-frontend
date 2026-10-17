import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { AppError } from '@/services/errors';
import { useAuthStore } from '@/stores/auth.store';
import type { AccountantProfile } from '@/types/domain';
import LoginPage from './LoginPage';

const ACCOUNTANT: AccountantProfile = { id: 'cpt-1', prenom: 'Aminata', nom: 'Diagne', role: 'ACCOUNTANT', email: 'a@x.sn' };

describe('LoginPage', () => {
  // Le magasin d'authentification est un singleton Zustand partagé par tout
  // le module : sans cette remise à zéro, une connexion réussie dans un test
  // laisserait les suivants déjà « authentifiés » et redirigés ailleurs.
  beforeEach(() => {
    useAuthStore.setState({ status: 'anonymous', accountant: null });
  });

  it('affiche le message d’erreur du service en cas d’échec', async () => {
    const login = vi.fn().mockRejectedValue(new AppError('validation', 'Identifiant ou mot de passe incorrect.', 400));
    renderWithProviders(<LoginPage />, { services: { auth: { login, logout: vi.fn(), currentAccountant: vi.fn() } } });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/identifiant/i), '77 520 00 01');
    await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => expect(screen.getByText('Identifiant ou mot de passe incorrect.')).toBeInTheDocument());
  });

  it('connecte avec succès et transmet les identifiants saisis', async () => {
    const login = vi.fn().mockResolvedValue(ACCOUNTANT);
    renderWithProviders(<LoginPage />, { services: { auth: { login, logout: vi.fn(), currentAccountant: vi.fn() } } });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/identifiant/i), '77 520 00 01');
    await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('77 520 00 01', 'motdepasse', true));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
  });
});
