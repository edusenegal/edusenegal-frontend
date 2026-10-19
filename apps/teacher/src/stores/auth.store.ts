/**
 * État d'authentification — même architecture que `apps/director`
 * (voir son `stores/auth.store.ts`) : `session` (jetons + contexte école)
 * est séparé de `teacher` (profil affiché), posé après coup.
 */

import { create } from 'zustand';
import { sessionStorageAdapter } from '@/services/session-storage';
import type { ApiSchoolType, LoginResponseDto, UserRole } from '@/types/api';
import type { TeacherProfile } from '@/types/domain';

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
  /** Écoles où l'enseignant a un profil actif — voir `SchoolSelectionPage`. */
  schools: string[];
}

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
  teacher: TeacherProfile | null;
  /**
   * Faux dès la connexion si l'enseignant a plusieurs écoles et n'a pas
   * encore choisi — voir `ProtectedRoute` et `SchoolSelectionPage`. Vrai
   * d'emblée pour un enseignant mono-école, et toujours vrai après une
   * restauration silencieuse de session (l'école active vient déjà d'un
   * choix antérieur, cf. `restoreSession`).
   */
  schoolConfirmed: boolean;
  setAuthenticating(): void;
  setSession(response: LoginResponseDto): void;
  updateTokens(response: LoginResponseDto): void;
  /** Changement d'école (bascule explicite) — remplace tout le contexte de session. */
  setSchoolContext(response: LoginResponseDto): void;
  confirmSchool(): void;
  setTeacher(teacher: TeacherProfile): void;
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
    role: response.role ?? 'TEACHER',
    schoolType: response.schoolType ?? 'LYCEE',
    mustChangePassword: response.mustChangePassword,
    schools: response.schools ?? [],
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  session: null,
  teacher: null,
  schoolConfirmed: true,

  setAuthenticating() {
    set({ status: 'authenticating' });
  },

  setSession(response) {
    const session = toSession(response);
    sessionStorageAdapter.writeRefreshToken(session.refreshToken);
    set({ session, schoolConfirmed: session.schools.length <= 1 });
  },

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

  setSchoolContext(response) {
    const current = get().session;
    const next = toSession(response);
    const session: AuthSession = {
      ...next,
      refreshToken: next.refreshToken || current?.refreshToken || '',
    };
    sessionStorageAdapter.writeRefreshToken(session.refreshToken);
    set({ session, schoolConfirmed: true });
  },

  confirmSchool() {
    set({ schoolConfirmed: true });
  },

  setTeacher(teacher) {
    set({ teacher, status: 'authenticated' });
  },

  clear() {
    sessionStorageAdapter.clear();
    set({ session: null, teacher: null, status: 'anonymous', schoolConfirmed: true });
  },
}));
