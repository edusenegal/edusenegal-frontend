import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { AppError } from '@/services/errors';
import { useAuthStore } from '@/stores/auth.store';
import type { DirectorProfile } from '@/types/domain';
import LoginPage from './LoginPage';

const DIRECTOR: DirectorProfile = { id: 'dir-1', prenom: 'Aminata', nom: 'Diagne', role: 'DIRECTOR', email: 'a@x.sn' };

describe('LoginPage', () => {
  // Le magasin d'authentification est un singleton Zustand partagé par tout
  // le module : sans cette remise à zéro, une connexion réussie dans un test
  // laisserait les suivants déjà « authentifiés » et redirigés ailleurs.
  beforeEach(() => {
    useAuthStore.setState({ status: 'anonymous', director: null });
  });

  it('affiche le message d’erreur du service en cas d’échec', async () => {
    const login = vi.fn().mockRejectedValue(new AppError('validation', 'Identifiant ou mot de passe incorrect.', 400));
    renderWithProviders(<LoginPage />, { services: { auth: { login, logout: vi.fn(), currentDirector: vi.fn() } } });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => expect(screen.getByText('Identifiant ou mot de passe incorrect.')).toBeInTheDocument());
  });

  it('connecte avec succès et transmet les identifiants saisis', async () => {
    const login = vi.fn().mockResolvedValue(DIRECTOR);
    renderWithProviders(<LoginPage />, { services: { auth: { login, logout: vi.fn(), currentDirector: vi.fn() } } });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('a.diagne@lyceelesflamboyants.sn', 'motdepasse'));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
  });
});
