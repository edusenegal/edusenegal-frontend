import { request } from '@/api/client';
import { AppError, toAppError } from '@/services/errors';
import { sessionStorageAdapter } from '@/services/session-storage';
import { useAuthStore, type AuthSession } from '@/stores/auth.store';
import type { AuthPort } from '@/services/ports';
import type { LoginResponseDto, UserResponseDto } from '@/types/api';
import type { TeacherProfile } from '@/types/domain';

/** Rôles autorisés dans l'espace bibliothèque. */
const ALLOWED = new Set(['LIBRARIAN', 'DIRECTOR', 'SUPER_ADMIN']);

function toProfile(dto: UserResponseDto): TeacherProfile {
  return {
    id: dto.id,
    prenom: dto.firstName,
    nom: dto.lastName,
    role: String(dto.role),
    email: dto.email ?? '',
    tel: dto.phone ?? null,
    photoUrl: dto.photoUrl ?? null,
  };
}

async function fetchProfile(userId: string): Promise<TeacherProfile> {
  const dto = await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(userId)}`);
  if (!ALLOWED.has(String(dto.role))) {
    throw new AppError('forbidden', "Ce compte n'a pas accès à l'espace Bibliothèque.", 403);
  }
  return toProfile(dto);
}

async function requestRefresh(refreshToken: string, accessToken?: string): Promise<LoginResponseDto> {
  return request<LoginResponseDto>('/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken, accessToken },
    anonymous: true,
  });
}

export function createAuthApi(): AuthPort {
  return {
    async login(identifier, password, loginByPhone): Promise<TeacherProfile> {
      try {
        const tokens = await request<LoginResponseDto>('/api/v1/auth/login', {
          method: 'POST',
          body: { identifier: identifier.trim(), password, loginByPhone },
          anonymous: true,
        });
        useAuthStore.getState().setSession(tokens);
        return await fetchProfile(tokens.userId ?? '');
      } catch (error) {
        useAuthStore.getState().clear();
        throw toAppError(error);
      }
    },

    async logout(): Promise<void> {
      await request<void>('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    },

    async updateMyPhoto(file: File): Promise<TeacherProfile> {
      const userId = useAuthStore.getState().session?.userId ?? '';
      const formData = new FormData();
      formData.append('file', file);
      const dto = await request<UserResponseDto>(
        `/api/v1/users/${encodeURIComponent(userId)}/photo`,
        { method: 'POST', formData },
      );
      return toProfile(dto);
    },

    async changePassword(newPassword: string): Promise<void> {
      const userId = useAuthStore.getState().session?.userId ?? '';
      await request<void>(`/api/v1/users/${encodeURIComponent(userId)}/change-password`, {
        method: 'PUT',
        body: { newPassword },
      });
    },
  };
}

/** Restauration silencieuse de session au démarrage. */
export async function restoreSession(): Promise<void> {
  const refreshToken = sessionStorageAdapter.readRefreshToken();
  if (!refreshToken) {
    useAuthStore.getState().clear();
    return;
  }
  try {
    const tokens = await requestRefresh(refreshToken);
    useAuthStore.getState().setSession(tokens);
    const profile = await fetchProfile(tokens.userId ?? '');
    useAuthStore.getState().setTeacher(profile);
  } catch {
    useAuthStore.getState().clear();
  }
}

/** Rafraîchissement planifié avant expiration — voir `AuthProvider`. */
export async function scheduledRefresh(session: AuthSession): Promise<void> {
  const tokens = await requestRefresh(session.refreshToken, session.accessToken);
  useAuthStore.getState().updateTokens(tokens);
}
