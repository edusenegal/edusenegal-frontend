import type { ReactNode } from 'react';
import { AppError } from '@/services/errors';
import { Button } from '@/components/ui/Button/Button';
import styles from './StateView.module.css';
import { Loader } from '@/components/Loader';

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
        <Loader role="teacher" />
        <p>Chargement…</p>
      </div>
    );
  }

  if (error) {
    // CORRECTION (demande explicite) -- jusqu'ici, une erreur qui n'est
    // PAS une AppError (ex. une exception JS inattendue dans un mapping
    // dto -> domaine) ne laissait absolument aucune trace : l'écran
    // affichait juste "Une erreur est survenue", invisible même en ouvrant
    // la console. Tous les écrans passant par StateView en bénéficient
    // d'un coup, sans modifier chaque écran -- toujours loggé (pas
    // seulement derrière le drapeau de debug des appels API dans
    // client.ts, qui journalise chaque requête/réponse : ici c'est
    // l'erreur elle-même, déjà peu bavarde).
    console.error('[StateView] erreur affichee a l\'ecran :', error);
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
