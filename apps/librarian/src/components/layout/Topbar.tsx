import { useLocation } from 'react-router-dom';
import { labelForPath } from '@/app/navigation';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { ThemeToggle } from './ThemeToggle';
import styles from './Topbar.module.css';

interface TopbarProps {
  onMenuClick(): void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const location = useLocation();
  return (
    <header className={styles.topbar}>
      <button type="button" className={styles.menuBtn} onClick={onMenuClick} aria-label="Ouvrir le menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <h1 className={styles.title}>{labelForPath(location.pathname)}</h1>
      <div className={styles.actions}>
        <ThemeToggle />
        <NotificationsBell />
      </div>
    </header>
  );
}
