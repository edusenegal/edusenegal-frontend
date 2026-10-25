import styles from './StatTile.module.css';

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  onClick?: () => void;
}

/** Tuile de synthèse du tableau de bord — une valeur, jamais un graphique nu. */
export function StatTile({ label, value, delta, tone = 'neutral', onClick }: StatTileProps) {
  const content = (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {delta ? <span className={[styles.delta, styles[tone]].join(' ')}>{delta}</span> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={[styles.tile, styles.clickable].filter(Boolean).join(' ')} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={styles.tile}>{content}</div>;
}
