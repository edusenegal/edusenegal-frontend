import { Button } from '../Button/Button';
import styles from './Pager.module.css';

interface PagerProps {
  /** Page courante, 0-indexée (même convention que le backend Spring Data). */
  page: number;
  totalPages: number;
  totalElements: number;
  onChange(page: number): void;
}

/**
 * Pagination réutilisable (nouvelle demande direction) — les listes longues
 * (élèves, …) chargeaient l'effectif complet en un seul appel. 0-indexée
 * pour matcher directement les pages Spring Data côté backend ; n'affiche
 * rien pour une seule page.
 */
export function Pager({ page, totalPages, totalElements, onChange }: PagerProps) {
  if (totalPages <= 1) return null;
  return (
    <div className={styles.row}>
      <span className={styles.count}>{totalElements} au total</span>
      <div className={styles.controls}>
        <Button variant="secondary" size="sm" disabled={page <= 0} onClick={() => onChange(page - 1)}>
          Précédent
        </Button>
        <span className={styles.page}>
          Page {page + 1} / {totalPages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
