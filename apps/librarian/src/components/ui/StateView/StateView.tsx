import type { ReactNode } from 'react';
import { AppError } from '@/services/errors';
import { Button } from '@/components/ui/Button/Button';
import styles from './StateView.module.css';

interface StateViewProps {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyLabel?: string;
  onRetry?(): void;
  children?: ReactNode;
}

/**
 * Enveloppe unique pour les trois états qu'un écran alimenté par
 * TanStack Query doit toujours distinguer : chargement, erreur, vide.
 * Sans elle, chaque écran réinvente sa propre variante — souvent en
 * oubliant l'un des trois.
 */
export function StateView({ loading, error, empty, emptyLabel = 'Rien à afficher pour le moment.', onRetry, children }: StateViewProps) {
  if (loading) {
    return (
      <div className={styles.state} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        <p>Chargement…</p>
      </div>
    );
  }

  if (error) {
    const message = error instanceof AppError ? error.message : 'Une erreur est survenue.';
    return (
      <div className={styles.state}>
        <p className={styles.errorText}>{message}</p>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Réessayer
          </Button>
        ) : null}
      </div>
    );
  }

  if (empty) {
    return (
      <div className={styles.state}>
        <p className={styles.emptyText}>{emptyLabel}</p>
      </div>
    );
  }

  return <>{children}</>;
}
