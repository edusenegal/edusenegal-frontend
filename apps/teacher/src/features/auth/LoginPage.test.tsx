import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { AppError } from '@/services/errors';
import { useAuthStore } from '@/stores/auth.store';
import type { TeacherProfile } from '@/types/domain';
import LoginPage from './LoginPage';

const TEACHER: TeacherProfile = {
  id: 'teach-1',
  prenom: 'Moussa',
  nom: 'Sarr',
  role: 'TEACHER',
  email: 'm@x.sn',
  tel: null,
  subjectIds: [],
  photoUrl: null,
};

describe('LoginPage', () => {
  // Le magasin d'authentification est un singleton Zustand partagé par tout
  // le module : sans cette remise à zéro, une connexion réussie dans un test
  // laisserait les suivants déjà « authentifiés » et redirigés ailleurs.
  beforeEach(() => {
    useAuthStore.setState({ status: 'anonymous', teacher: null });
  });

  it('affiche le message d’erreur du service en cas d’échec', async () => {
    const login = vi.fn().mockRejectedValue(new AppError('validation', 'Identifiant ou mot de passe incorrect.', 400));
    renderWithProviders(<LoginPage />, {
      services: { auth: { login, logout: vi.fn(), currentTeacher: vi.fn(), changePassword: vi.fn() } },
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/identifiant/i), '77 520 00 01');
    await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => expect(screen.getByText('Identifiant ou mot de passe incorrect.')).toBeInTheDocument());
  });

  it('connecte avec succès et transmet les identifiants saisis', async () => {
    const login = vi.fn().mockResolvedValue(TEACHER);
    renderWithProviders(<LoginPage />, {
      services: { auth: { login, logout: vi.fn(), currentTeacher: vi.fn(), changePassword: vi.fn() } },
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/identifiant/i), '77 520 00 01');
    await user.type(screen.getByLabelText(/mot de passe/i), 'motdepasse');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('77 520 00 01', 'motdepasse', true));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
  });
});
