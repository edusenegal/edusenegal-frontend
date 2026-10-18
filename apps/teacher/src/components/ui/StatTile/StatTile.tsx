import styles from './StatTile.module.css';

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}

/** Tuile de synthèse du tableau de bord — une valeur, jamais un graphique nu. */
export function StatTile({ label, value, delta, tone = 'neutral' }: StatTileProps) {
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {delta ? <span className={[styles.delta, styles[tone]].join(' ')}>{delta}</span> : null}
    </div>
  );
}
