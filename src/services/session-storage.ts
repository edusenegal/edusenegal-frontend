/**
 * Conservation légère de la session, côté navigateur.
 *
 * Sur la branche `mock`, il n'y a pas de jeton réel à conserver — seul le
 * profil du directeur est gardé, pour qu'un rechargement de page ne
 * reparte pas sur l'écran de connexion. Une branche `api` enrichirait ceci
 * avec un vrai jeton d'accès/rafraîchissement, à l'image de
 * `student/web/src/services/session-storage.ts` — le point de remplacement
 * est ici, et nulle part ailleurs.
 */

import type { DirectorProfile } from '@/types/domain';

const DIRECTOR_KEY = 'edusenegal.director.session';

function safeRead(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    // Navigation privée ou stockage bloqué : on repart d'une session vierge.
    return null;
  }
}

function safeWrite(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
    }
  } catch {
    // Sans stockage, la session dure le temps du rendu : acceptable en mock.
  }
}

export const sessionStorageAdapter = {
  readDirector(): DirectorProfile | null {
    const raw = safeRead(DIRECTOR_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DirectorProfile;
    } catch {
      return null;
    }
  },
  writeDirector(director: DirectorProfile | null): void {
    safeWrite(DIRECTOR_KEY, director ? JSON.stringify(director) : null);
  },
};
