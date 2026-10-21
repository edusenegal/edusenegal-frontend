/**
 * Conservation de la session.
 *
 * Le refresh token va en `localStorage`, faute de cookie HttpOnly côté
 * gateway aujourd'hui — il doit survivre à la fermeture de l'onglet, pas
 * seulement à un rechargement. L'access token reste en mémoire (dans le
 * magasin Zustand) : il ne survit pas à un rechargement, il est redemandé
 * via le refresh au démarrage. Même convention que `student/web`.
 */

const REFRESH_KEY = 'edusenegal.director.refresh';

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Navigation privée ou stockage bloqué : on repart d'une session vierge.
    return null;
  }
}

function safeWrite(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Sans stockage, la session dure le temps de l'onglet : acceptable.
  }
}

export const sessionStorageAdapter = {
  readRefreshToken(): string | null {
    return safeRead(REFRESH_KEY);
  },
  writeRefreshToken(token: string | null): void {
    safeWrite(REFRESH_KEY, token);
  },
  clear(): void {
    safeWrite(REFRESH_KEY, null);
  },
};
