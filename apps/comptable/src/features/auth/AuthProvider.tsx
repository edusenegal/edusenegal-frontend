import { useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { config } from '@/app/config';
import { restoreSession, scheduledRefresh } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { AppError } from '@/services/errors';

/**
 * Cycle de vie de la session réelle (branche `api`) — absent de la branche
 * `mock`, qui restaure son « profil » de façon synchrone, sans jeton. Deux
 * responsabilités, volontairement hors du magasin Zustand qui ne contient
 * que l'état :
 *  1. au démarrage, tenter un rafraîchissement silencieux à partir du jeton
 *     conservé, pour qu'un rechargement de page ne renvoie pas la direction
 *     à la connexion ;
 *  2. pendant la session, replanifier un rafraîchissement avant chaque
 *     expiration.
 *
 * Même rôle que `student/web/src/features/auth/AuthProvider.tsx`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  const clear = useAuthStore((s) => s.clear);
  const timerRef = useRef<number | undefined>(undefined);
  const idleRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (status === 'idle') {
      void restoreSession();
    }
  }, [status]);

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    if (!session) {
      return;
    }

    const delay = session.expiresAt - Date.now() - config.tokenRefreshMargin * 1000;
    timerRef.current = window.setTimeout(
      () => {
        void scheduledRefresh(session).catch((err) => {
          // Panne TRANSITOIRE (réseau, 429, 5xx) : on NE déconnecte PAS en
          // pleine manipulation — l'intercepteur retentera au prochain appel.
          // Seul un refresh token invalide (401) ferme la session.
          if (err instanceof AppError && err.kind === 'unauthorized') {
            clear();
            queryClient.clear();
          }
        });
      },
      Math.max(5_000, delay),
    );

    return () => window.clearTimeout(timerRef.current);
  }, [session, clear, queryClient]);


  // Déconnexion automatique après 30 minutes d'inactivité (aucune action
  // souris/clavier/tactile). Toute activité réarme le minuteur.
  useEffect(() => {
    if (!session) return;
    const IDLE_LIMIT_MS = 30 * 60 * 1000;
    const reset = () => {
      window.clearTimeout(idleRef.current);
      idleRef.current = window.setTimeout(() => {
        clear();
        queryClient.clear();
      }, IDLE_LIMIT_MS);
    };
    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];
    const opts: AddEventListenerOptions = { passive: true };
    events.forEach((e) => window.addEventListener(e, reset, opts));
    reset();
    return () => {
      window.clearTimeout(idleRef.current);
      events.forEach((e) => window.removeEventListener(e, reset, opts));
    };
  }, [session, clear, queryClient]);

  return <>{children}</>;
}
