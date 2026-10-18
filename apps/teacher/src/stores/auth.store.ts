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
}

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
  teacher: TeacherProfile | null;
  setAuthenticating(): void;
  setSession(response: LoginResponseDto): void;
  updateTokens(response: LoginResponseDto): void;
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
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  session: null,
  teacher: null,

  setAuthenticating() {
    set({ status: 'authenticating' });
  },

  setSession(response) {
    const session = toSession(response);
    sessionStorageAdapter.writeRefreshToken(session.refreshToken);
    set({ session });
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

  setTeacher(teacher) {
    set({ teacher, status: 'authenticated' });
  },

  clear() {
    sessionStorageAdapter.clear();
    set({ session: null, teacher: null, status: 'anonymous' });
  },
}));
