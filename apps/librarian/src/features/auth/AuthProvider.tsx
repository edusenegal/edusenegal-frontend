import { useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { config } from '@/app/config';
import { restoreSession, scheduledRefresh } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Cycle de vie de la session réelle — même rôle que `apps/director` (voir
 * son `AuthProvider`) : restauration silencieuse au démarrage, puis
 * replanification d'un rafraîchissement avant chaque expiration.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  const clear = useAuthStore((s) => s.clear);
  const timerRef = useRef<number | undefined>(undefined);

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
        void scheduledRefresh(session).catch(() => {
          clear();
          queryClient.clear();
        });
      },
      Math.max(5_000, delay),
    );

    return () => window.clearTimeout(timerRef.current);
  }, [session, clear, queryClient]);

  return <>{children}</>;
}
