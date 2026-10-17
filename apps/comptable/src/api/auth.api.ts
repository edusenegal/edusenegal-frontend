import { request } from '@/api/client';
import { AppError, toAppError } from '@/services/errors';
import { sessionStorageAdapter } from '@/services/session-storage';
import { useAuthStore, type AuthSession } from '@/stores/auth.store';
import type { AuthPort } from '@/services/ports';
import type { LoginResponseDto, UserResponseDto } from '@/types/api';
import type { AccountantProfile } from '@/types/domain';

function toAccountantProfile(dto: UserResponseDto): AccountantProfile {
  return {
    id: dto.id,
    prenom: dto.firstName,
    nom: dto.lastName,
    role: 'ACCOUNTANT',
    email: dto.email ?? '',
  };
}

/** `/auth/login` et `/auth/refresh` ne portent ni nom ni e-mail — seul `user-service` les a. */
async function fetchAccountantProfile(userId: string): Promise<AccountantProfile> {
  const dto = await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(userId)}`);
  return toAccountantProfile(dto);
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
    async login(identifier, password, loginByPhone): Promise<AccountantProfile> {
      try {
        const trimmedIdentifier = identifier.trim();
        const tokens = await request<LoginResponseDto>('/api/v1/auth/login', {
          method: 'POST',
          body: { identifier: trimmedIdentifier, password, loginByPhone },
          anonymous: true,
        });
        useAuthStore.getState().setSession(tokens);
        return await fetchAccountantProfile(tokens.userId ?? '');
      } catch (error) {
        // Une session partiellement posée (jetons reçus, profil introuvable)
        // ne doit pas laisser `status` bloqué sur « authenticating ».
        useAuthStore.getState().clear();
        const appError = toAppError(error);
        // Un 401 veut dire « ta session a expiré » partout ailleurs — sauf
        // ici, où il n'y a pas encore de session. La passerelle rend le même
        // 401 pour un identifiant inconnu, un mot de passe faux et un compte
        // désactivé : l'écran de connexion dit donc exactement cela, sans
        // laisser deviner lequel des trois.
        if (appError.status === 401) {
          throw new AppError('unauthorized', 'Identifiant ou mot de passe incorrect.', 401);
        }
        throw appError;
      }
    },

    async logout(): Promise<void> {
      // La gateway traite la déconnexion en « best effort » et répond 200 :
      // une erreur ici ne doit pas empêcher de vider la session locale.
      await request<void>('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    },

    async currentAccountant(): Promise<AccountantProfile> {
      const userId = useAuthStore.getState().session?.userId ?? '';
      return fetchAccountantProfile(userId);
    },
  };
}

/**
 * Restauration silencieuse au démarrage, à partir du jeton de rafraîchissement
 * conservé — pour qu'un rechargement de page ne renvoie pas le comptable à la
 * connexion. Distincte de `AuthPort` : ni un écran ni la connexion explicite
 * n'en ont besoin, seul `AuthProvider` l'appelle une fois au montage.
 */
export async function restoreSession(): Promise<void> {
  const refreshToken = sessionStorageAdapter.readRefreshToken();
  if (!refreshToken) {
    useAuthStore.getState().clear();
    return;
  }
  try {
    const tokens = await requestRefresh(refreshToken);
    useAuthStore.getState().setSession(tokens);
    const accountant = await fetchAccountantProfile(tokens.userId ?? '');
    useAuthStore.getState().setAccountant(accountant);
  } catch {
    // Jeton refusé ou réseau indisponible : dans les deux cas le comptable
    // repasse par la connexion plutôt que de réessayer en boucle.
    useAuthStore.getState().clear();
  }
}

/** Rafraîchissement planifié, avant expiration — voir `AuthProvider`. */
export async function scheduledRefresh(session: AuthSession): Promise<void> {
  const tokens = await requestRefresh(session.refreshToken, session.accessToken);
  useAuthStore.getState().updateTokens(tokens);
}
