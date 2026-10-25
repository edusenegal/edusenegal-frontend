/**
 * Conservation de la session — même convention que `apps/director` : le
 * refresh token va en `localStorage` (survit à la fermeture de l'onglet),
 * l'access token reste en mémoire (magasin Zustand).
 */

const REFRESH_KEY = 'edusenegal.teacher.refresh';

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
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
