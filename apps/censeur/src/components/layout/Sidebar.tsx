import { useQueryClient } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { NAV_GROUPS } from '@/app/navigation';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import { Button } from '@/components/ui/Button/Button';
import { useServices } from '@/hooks/useServices';
import { useAuthStore } from '@/stores/auth.store';
import type { School } from '@/types/domain';
import styles from './Sidebar.module.css';

interface SidebarProps {
  school: School | undefined;
  mobileOpen: boolean;
  onNavigate(): void;
}

export function Sidebar({ school, mobileOpen, onNavigate }: SidebarProps) {
  const { auth } = useServices();
  const queryClient = useQueryClient();
  const director = useAuthStore((s) => s.director);
  const clear = useAuthStore((s) => s.clear);

  async function onLogout() {
    try {
      await auth.logout();
    } finally {
      // Le cache contient des données scolaires : il est vidé même si
      // l'appel de déconnexion échoue — la gateway la traite en best effort,
      // mais la session locale doit disparaître dans tous les cas.
      clear();
      queryClient.clear();
    }
  }

  return (
    <aside className={[styles.sidebar, mobileOpen ? styles.open : ''].join(' ')}>
      <div className={styles.brand}>
        {school?.logoUrl ? (
          <img src={school.logoUrl} alt="" className={styles.logoImg} aria-hidden="true" />
        ) : (
          <span className={styles.logo} aria-hidden="true">
            ◆
          </span>
        )}
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
            <Avatar name={`${director.prenom} ${director.nom}`} size="sm" photoUrl={director.photoUrl} />
            <div>
              <div className={styles.name}>
                {director.prenom} {director.nom}
              </div>
              <div className={styles.role}>
                {director.role === 'CENSEUR' ? 'Censeur' : 'Surveillant général'}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            Déconnexion
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
