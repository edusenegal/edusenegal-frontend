/**
 * État d'authentification.
 *
 * Zustand plutôt qu'un contexte React : le client HTTP (`src/api/client.ts`)
 * a besoin de lire le jeton courant hors de l'arbre de composants, et de le
 * remplacer après un rafraîchissement sans provoquer de rendu en cascade.
 * Même rôle que `student/web/src/stores/auth.store.ts`.
 *
 * Deux informations distinctes, volontairement séparées :
 *  - `session` : le jeton JWT et le contexte école qu'il porte — c'est tout
 *    ce dont le client HTTP a besoin, restauré par un simple rafraîchissement
 *    silencieux au démarrage ;
 *  - `director` : le profil affiché (nom, e-mail) — absent du jeton et de
 *    `/auth/refresh`, posé séparément après coup (`GET /users/{userId}`, voir
 *    `auth.api.ts`). `status` ne passe « authenticated » qu'une fois les deux
 *    posés, pour que l'interface n'affiche jamais une fiche à moitié vide.
 */

import { create } from 'zustand';
import { sessionStorageAdapter } from '@/services/session-storage';
import type { ApiSchoolType, LoginResponseDto, UserRole } from '@/types/api';
import type { DirectorProfile } from '@/types/domain';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Horodatage epoch en millisecondes. */
  expiresAt: number;
  userId: string;
  schoolId: string;
  schoolUserId: string;
  schoolIndicatif: string;
  role: UserRole;
  schoolType: ApiSchoolType;
  mustChangePassword: boolean;
}

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
  director: DirectorProfile | null;
  setAuthenticating(): void;
  setSession(response: LoginResponseDto): void;
  updateTokens(response: LoginResponseDto): void;
  setDirector(director: DirectorProfile): void;
  clear(): void;
}

function toSession(response: LoginResponseDto): AuthSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: Date.now() + response.expiresIn * 1000,
    userId: response.userId ?? '',
    schoolId: response.activeSchoolId ?? '',
    schoolUserId: response.schoolUserId ?? '',
    schoolIndicatif: response.schoolIndicatif ?? '',
    role: response.role ?? 'DIRECTOR',
    schoolType: response.schoolType ?? 'LYCEE',
    mustChangePassword: response.mustChangePassword,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  session: null,
  director: null,

  setAuthenticating() {
    set({ status: 'authenticating' });
  },

  setSession(response) {
    const session = toSession(response);
    sessionStorageAdapter.writeRefreshToken(session.refreshToken);
    set({ session });
  },

  /** Après un rafraîchissement : le contexte école ne change pas, seuls les jetons. */
  updateTokens(response) {
    const current = get().session;
    if (!current) {
      return;
    }
    const session: AuthSession = {
      ...current,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken || current.refreshToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
    };
    sessionStorageAdapter.writeRefreshToken(session.refreshToken);
    set({ session });
  },

  setDirector(director) {
    set({ director, status: 'authenticated' });
  },

  clear() {
    sessionStorageAdapter.clear();
    set({ session: null, director: null, status: 'anonymous' });
  },
}));
