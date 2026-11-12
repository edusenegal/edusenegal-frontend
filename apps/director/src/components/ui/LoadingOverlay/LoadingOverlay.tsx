import styles from './LoadingOverlay.module.css';

interface LoadingOverlayProps {
  open: boolean;
  message?: string;
  /** Progression optionnelle — pour les traitements de masse (bulletins, bulk). */
  progress?: { done: number; total: number };
}

/**
 * Voile modal bloquant « veuillez patienter ». Empêche l'utilisateur de
 * recliquer pendant une opération longue (création d'élève, génération de
 * bulletins, traitements en masse). Avec `progress`, affiche une barre
 * done/total pour le polling d'un job asynchrone.
 */
export function LoadingOverlay({ open, message = 'Veuillez patienter…', progress }: LoadingOverlayProps) {
  if (!open) return null;
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null;
  return (
    <div className={styles.backdrop} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.card}>
        <span className={styles.spinner} aria-hidden="true" />
        <p className={styles.message}>{message}</p>
        {progress ? (
          <>
            <div className={styles.bar}>
              <div className={styles.fill} style={{ width: `${pct ?? 0}%` }} />
            </div>
            <p className={styles.count}>
              {progress.done} / {progress.total}
              {pct !== null ? ` (${pct}%)` : ''}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
