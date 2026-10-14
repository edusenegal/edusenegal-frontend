import { NavLink } from 'react-router-dom';
import { NAV_GROUPS } from '@/app/navigation';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import { Button } from '@/components/ui/Button/Button';
import { useAuthStore } from '@/stores/auth.store';
import type { School } from '@/types/domain';
import styles from './Sidebar.module.css';

interface SidebarProps {
  school: School | undefined;
  mobileOpen: boolean;
  onNavigate(): void;
}

export function Sidebar({ school, mobileOpen, onNavigate }: SidebarProps) {
  const director = useAuthStore((s) => s.director);
  const clear = useAuthStore((s) => s.clear);

  return (
    <aside className={[styles.sidebar, mobileOpen ? styles.open : ''].join(' ')}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden="true">
          ◆
        </span>
        <div>
          <b>EduSénégal</b>
          <div className={styles.school}>{school?.name ?? '—'}</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className={styles.group}>
            <div className={styles.groupLabel}>{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) => [styles.link, isActive ? styles.active : ''].join(' ')}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {director ? (
        <div className={styles.foot}>
          <div className={styles.who}>
            <Avatar name={`${director.prenom} ${director.nom}`} size="sm" />
            <div>
              <div className={styles.name}>
                {director.prenom} {director.nom}
              </div>
              <div className={styles.role}>Direction</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={clear}>
            Déconnexion
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
