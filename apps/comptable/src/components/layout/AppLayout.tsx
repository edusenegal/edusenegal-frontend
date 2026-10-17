import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/hooks/useServices';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import styles from './AppLayout.module.css';

/** Coquille de l'application : sidebar + topbar + contenu de la route active. */
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { school: schoolService } = useServices();
  const { data: school } = useQuery({ queryKey: ['school'], queryFn: () => schoolService.getSchool() });

  return (
    <div className={styles.shell}>
      <Sidebar school={school} mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen ? <div className={styles.backdrop} onClick={() => setMobileOpen(false)} /> : null}
      <div className={styles.main}>
        <Topbar onMenuClick={() => setMobileOpen((v) => !v)} />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
