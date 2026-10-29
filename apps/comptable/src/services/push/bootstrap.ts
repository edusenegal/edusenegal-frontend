import { useAuthStore } from '@/stores/auth.store';
import { registerPush, unregisterPush } from './push';

let wasAuthenticated = false;

/**
 * Lie le cycle de vie du push à l'authentification : enregistrement du jeton
 * dès qu'une session s'ouvre, retrait dès qu'elle se ferme. Abonné au store
 * Zustand hors de l'arbre React (comme le client HTTP).
 */
export function startPushLifecycle(): void {
  const evaluate = (status: string): void => {
    const authenticated = status === 'authenticated';
    if (authenticated && !wasAuthenticated) {
      wasAuthenticated = true;
      void registerPush();
    } else if (!authenticated && wasAuthenticated) {
      wasAuthenticated = false;
      void unregisterPush();
    }
  };
  evaluate(useAuthStore.getState().status);
  useAuthStore.subscribe((state) => evaluate(state.status));
}
