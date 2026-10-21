import { useLocation } from 'react-router-dom';
import { labelForPath } from '@/app/navigation';
import styles from './Topbar.module.css';

interface TopbarProps {
  onMenuClick(): void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const location = useLocation();
  return (
    <header className={styles.topbar}>
      <button type="button" className={styles.menuBtn} onClick={onMenuClick} aria-label="Ouvrir le menu">
        ☰
      </button>
      <h1 className={styles.title}>{labelForPath(location.pathname)}</h1>
    </header>
  );
}
