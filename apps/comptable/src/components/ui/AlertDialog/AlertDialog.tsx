import { Button } from '@/components/ui/Button/Button';
import styles from './AlertDialog.module.css';

interface AlertDialogProps {
  /** Message à afficher. */
  message: string;
  /** Fermeture (clic sur le bouton ou le fond). */
  onClose: () => void;
  /** Titre court. Défaut : « Oups ». */
  title?: string;
}

/**
 * Popup d'alerte centrée au milieu de l'écran, fermable au clic (bouton ou
 * fond). Remplace les messages d'erreur inline par une boîte de dialogue
 * modale, plus visible et cohérente.
 */
export function AlertDialog({ message, onClose, title = 'Oups' }: AlertDialogProps) {
  return (
    <div
      className={styles.overlay}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.badge} aria-hidden="true">!</div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <Button variant="primary" onClick={onClose} style={{ width: '100%' }}>
          J'ai compris
        </Button>
      </div>
    </div>
  );
}
