/**
 * État d'authentification.
 *
 * Zustand plutôt qu'un contexte React, pour que les routes protégées et le
 * futur client HTTP (branche `api`) puissent lire la session sans
 * dépendre de l'arbre de composants.
 */

import { create } from 'zustand';
import { sessionStorageAdapter } from '@/services/session-storage';
import type { DirectorProfile } from '@/types/domain';

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  director: DirectorProfile | null;
  setAuthenticating(): void;
  setDirector(director: DirectorProfile): void;
  clear(): void;
}

const restored = sessionStorageAdapter.readDirector();

export const useAuthStore = create<AuthState>((set) => ({
  status: restored ? 'authenticated' : 'anonymous',
  director: restored,

  setAuthenticating() {
    set({ status: 'authenticating' });
  },

  setDirector(director) {
    sessionStorageAdapter.writeDirector(director);
    set({ director, status: 'authenticated' });
  },

  clear() {
    sessionStorageAdapter.writeDirector(null);
    set({ director: null, status: 'anonymous' });
  },
}));
