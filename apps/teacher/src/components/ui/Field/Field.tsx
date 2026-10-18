import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from 'react';
import styles from './Field.module.css';

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/** Enveloppe label + contrôle + erreur — jamais un input nu dans un écran. */
export function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>
        {label} {required ? <span className={styles.required}>*</span> : null}
      </span>
      {children}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
      {error ? <span className={styles.error}>{error}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={styles.control} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={styles.control} {...props} />;
}

export function Textarea(props: InputHTMLAttributes<HTMLTextAreaElement> & { rows?: number }) {
  const { rows = 4, ...rest } = props;
  return <textarea className={styles.control} rows={rows} {...rest} />;
}

/**
 * Toujours `type="date"` (ou `type="month"`) — jamais un champ texte libre
 * pour une date : c'est une exigence explicite du produit, pas un détail
 * de style.
 */
export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" className={styles.control} {...props} />;
}

export function MonthInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="month" className={styles.control} {...props} />;
}
