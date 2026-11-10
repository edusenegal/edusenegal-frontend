import { useEffect, useState } from 'react';
import { subscribeToasts, dismissToast, type ToastItem } from '@/services/toast';
import styles from './Toast.module.css';

/** Pile de toasts fermables, montée une fois à la racine de l'app. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);
  if (items.length === 0) return null;
  return (
    <div className={styles.wrap} role="region" aria-label="Notifications">
      {items.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.kind]}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <div className={styles.body}>
            {t.title ? <p className={styles.title}>{t.title}</p> : null}
            <p className={styles.msg}>{t.message}</p>
          </div>
          <button type="button" className={styles.close} onClick={() => dismissToast(t.id)} aria-label="Fermer">×</button>
        </div>
      ))}
    </div>
  );
}

export default Toaster;
