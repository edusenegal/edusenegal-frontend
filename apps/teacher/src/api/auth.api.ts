import { request } from '@/api/client';
import { AppError, toAppError } from '@/services/errors';
import { sessionStorageAdapter } from '@/services/session-storage';
import { useAuthStore, type AuthSession } from '@/stores/auth.store';
import { clearContextCache } from '@/api/context';
import type { AuthPort } from '@/services/ports';
import type { LoginResponseDto, UserResponseDto } from '@/types/api';
import type { TeacherProfile } from '@/types/domain';

function toTeacherProfile(dto: UserResponseDto): TeacherProfile {
  return {
    id: dto.id,
    prenom: dto.firstName,
    nom: dto.lastName,
    role: dto.role === 'INSTITUTEUR' ? 'INSTITUTEUR' : 'TEACHER',
    email: dto.email ?? '',
    tel: dto.phone ?? null,
    subjectIds: dto.subjectIds ?? [],
    photoUrl: dto.photoUrl ?? null,
  };
}

/** `/auth/login` et `/auth/refresh` ne portent ni nom ni e-mail — seul `user-service` les a. */
async function fetchTeacherProfile(userId: string): Promise<TeacherProfile> {
  const dto = await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(userId)}`);
  // Un compte valide mais sans le rôle TEACHER/INSTITUTEUR (comptable, élève,
  // direction…) ne doit jamais ouvrir cet espace — même garde que
  // `apps/director`/`apps/comptable` pour leurs rôles respectifs.
  if (dto.role !== 'TEACHER' && dto.role !== 'INSTITUTEUR') {
    throw new AppError('forbidden', "Ce compte n'a pas accès à l'espace Enseignant.", 403);
  }
  return toTeacherProfile(dto);
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
        const trimmedIdentifier = identifier.trim();
        const tokens = await request<LoginResponseDto>('/api/v1/auth/login', {
          method: 'POST',
          body: { identifier: trimmedIdentifier, password, loginByPhone },
          anonymous: true,
        });
        useAuthStore.getState().setSession(tokens);
        return await fetchTeacherProfile(tokens.userId ?? '');
      } catch (error) {
        useAuthStore.getState().clear();
        const appError = toAppError(error);
        if (appError.status === 401) {
          throw new AppError('unauthorized', 'Identifiant ou mot de passe incorrect.', 401);
        }
        throw appError;
      }
    },

    async logout(): Promise<void> {
      await request<void>('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    },

    async currentTeacher(): Promise<TeacherProfile> {
      const userId = useAuthStore.getState().session?.userId ?? '';
      return fetchTeacherProfile(userId);
    },

    async changePassword(newPassword: string): Promise<void> {
      const userId = useAuthStore.getState().session?.userId ?? '';
      await request<void>(`/api/v1/users/${encodeURIComponent(userId)}/change-password`, {
        method: 'PUT',
        body: { newPassword },
      });
    },

    /**
     * Bascule le contexte école actif — mint un nouveau jeton côté passerelle
     * (voir `/api/v1/auth/switch-school`), pas une simple préférence locale :
     * toute requête suivante doit porter le claim `school_id` de la nouvelle
     * école. Le cache d'année scolaire (`context.ts`) est invalidé : il était
     * résolu pour l'ancienne école.
     */
    async switchSchool(schoolId: string): Promise<TeacherProfile> {
      const response = await request<LoginResponseDto>('/api/v1/auth/switch-school', {
        method: 'POST',
        body: { schoolId },
      });
      useAuthStore.getState().setSchoolContext(response);
      clearContextCache();
      const teacher = await fetchTeacherProfile(response.userId ?? '');
      useAuthStore.getState().setTeacher(teacher);
      return teacher;
    },

    async updateMyPhoto(file: File): Promise<TeacherProfile> {
      const userId = useAuthStore.getState().session?.userId ?? '';
      const formData = new FormData();
      formData.append('file', file);
      const dto = await request<UserResponseDto>(
        `/api/v1/users/${encodeURIComponent(userId)}/photo`,
        { method: 'POST', formData },
      );
      const teacher = toTeacherProfile(dto);
      useAuthStore.getState().setTeacher(teacher);
      return teacher;
    },
  };
}

/** Restauration silencieuse au démarrage — voir `apps/director`. */
export async function restoreSession(): Promise<void> {
  const refreshToken = sessionStorageAdapter.readRefreshToken();
  if (!refreshToken) {
    useAuthStore.getState().clear();
    return;
  }
  try {
    const tokens = await requestRefresh(refreshToken);
    useAuthStore.getState().setSession(tokens);
    // Une session restaurée reprend l'école déjà active côté serveur (choisie
    // à une connexion antérieure, cf. `switchSchool` qui la persiste) : on ne
    // renvoie pas l'enseignant au choix d'école à chaque rechargement de page.
    useAuthStore.getState().confirmSchool();
    const teacher = await fetchTeacherProfile(tokens.userId ?? '');
    useAuthStore.getState().setTeacher(teacher);
  } catch {
    useAuthStore.getState().clear();
  }
}

/** Rafraîchissement planifié, avant expiration — voir `AuthProvider`. */
export async function scheduledRefresh(session: AuthSession): Promise<void> {
  const tokens = await requestRefresh(session.refreshToken, session.accessToken);
  useAuthStore.getState().updateTokens(tokens);
}
