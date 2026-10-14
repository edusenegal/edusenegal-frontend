import styles from './Meter.module.css';

interface MeterProps {
  value: number; // 0-100
  tone?: 'success' | 'warning' | 'danger' | 'brand';
}

export function Meter({ value, tone = 'brand' }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={styles.track} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className={[styles.fill, styles[tone]].join(' ')} style={{ width: `${clamped}%` }} />
    </div>
  );
}
