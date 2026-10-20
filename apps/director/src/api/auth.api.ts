import { request } from '@/api/client';
import { AppError, toAppError } from '@/services/errors';
import { sessionStorageAdapter } from '@/services/session-storage';
import { useAuthStore, type AuthSession } from '@/stores/auth.store';
import type { AuthPort } from '@/services/ports';
import type { LoginResponseDto, UserResponseDto } from '@/types/api';
import type { DirectorProfile } from '@/types/domain';

function toDirectorProfile(dto: UserResponseDto): DirectorProfile {
  return {
    id: dto.id,
    prenom: dto.firstName,
    nom: dto.lastName,
    role: 'DIRECTOR',
    email: dto.email ?? '',
    photoUrl: dto.photoUrl ?? null,
  };
}

/** `/auth/login` et `/auth/refresh` ne portent ni nom ni e-mail — seul `user-service` les a. */
async function fetchDirectorProfile(userId: string): Promise<DirectorProfile> {
  const dto = await request<UserResponseDto>(`/api/v1/users/${encodeURIComponent(userId)}`);
  // CORRECTION (demande explicite) : la connexion valide les identifiants
  // pour TOUT le monde (serveur d'auth central, partagé par tous les
  // frontends) -- rien ici ne vérifiait que ce compte a bien le rôle
  // DIRECTOR avant de le laisser entrer. `toDirectorProfile` ci-dessous
  // affectait `role: 'DIRECTOR'` EN DUR, donc n'importe quel compte valide
  // (comptable, enseignant, élève...) passait pour un directeur. Un compte
  // sans ce rôle, même avec un bon mot de passe, est désormais refusé ici —
  // avant que l'app ne s'ouvre, pas après.
  if (dto.role !== 'DIRECTOR') {
    throw new AppError(
      'forbidden',
      "Ce compte n'a pas accès à l'espace Direction.",
      403,
    );
  }
  return toDirectorProfile(dto);
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
    async login(identifier, password, loginByPhone): Promise<DirectorProfile> {
      try {
        const trimmedIdentifier = identifier.trim();
        const tokens = await request<LoginResponseDto>('/api/v1/auth/login', {
          method: 'POST',
          // L'écran de connexion laisse la direction choisir explicitement
          // entre téléphone et matricule (voir `LoginPage`) — `loginByPhone`
          // vient directement de ce choix, transmis tel quel à la passerelle.
          body: { identifier: trimmedIdentifier, password, loginByPhone },
          anonymous: true,
        });
        useAuthStore.getState().setSession(tokens);
        return await fetchDirectorProfile(tokens.userId ?? '');
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

    async currentDirector(): Promise<DirectorProfile> {
      const userId = useAuthStore.getState().session?.userId ?? '';
      return fetchDirectorProfile(userId);
    },

    async updateMyPhoto(file: File): Promise<DirectorProfile> {
      const userId = useAuthStore.getState().session?.userId ?? '';
      const formData = new FormData();
      formData.append('file', file);
      const dto = await request<UserResponseDto>(
        `/api/v1/users/${encodeURIComponent(userId)}/photo`,
        { method: 'POST', formData },
      );
      return toDirectorProfile(dto);
    },
  };
}

/**
 * Restauration silencieuse au démarrage, à partir du jeton de rafraîchissement
 * conservé — pour qu'un rechargement de page ne renvoie pas la direction à la
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
    const director = await fetchDirectorProfile(tokens.userId ?? '');
    useAuthStore.getState().setDirector(director);
  } catch {
    // Jeton refusé ou réseau indisponible : dans les deux cas la direction
    // repasse par la connexion plutôt que de réessayer en boucle.
    useAuthStore.getState().clear();
  }
}

/** Rafraîchissement planifié, avant expiration — voir `AuthProvider`. */
export async function scheduledRefresh(session: AuthSession): Promise<void> {
  const tokens = await requestRefresh(session.refreshToken, session.accessToken);
  useAuthStore.getState().updateTokens(tokens);
}
