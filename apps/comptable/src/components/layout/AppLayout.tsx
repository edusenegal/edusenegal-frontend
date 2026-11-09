import { Suspense, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/hooks/useServices';
import { StateView } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import styles from './AppLayout.module.css';

/** Coquille de l'application : sidebar + topbar + contenu de la route active. */
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { school: schoolService } = useServices();
  const { data: school } = useQuery({ queryKey: ['school'], queryFn: () => schoolService.getSchool() });
  const location = useLocation();

  return (
    <div className={styles.shell}>
      <Sidebar school={school} mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen ? <div className={styles.backdrop} onClick={() => setMobileOpen(false)} /> : null}
      <div className={styles.main}>
        <Topbar onMenuClick={() => setMobileOpen((v) => !v)} />
        <main className={styles.content}>
          {/* Isole chaque page : un crash ou un chunk manquant n'efface plus
              toute l'application (page blanche) — la sidebar reste, la zone de
              contenu affiche un écran de secours. Remonté à chaque navigation. */}
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<StateView loading />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
