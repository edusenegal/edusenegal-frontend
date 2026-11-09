import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button } from '../Button/Button';

export interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Rend le bouton de confirmation rouge (action destructive/irréversible). */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Confirmation stylée et cohérente pour toute action irréversible
 * (supprimer, retirer…). `const confirm = useConfirm();` puis
 * `if (await confirm({ title, message, danger: true })) action();`.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm doit être utilisé dans <ConfirmProvider>.');
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options ? (
        <>
          <div
            onClick={() => settle(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000 }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(440px, calc(100vw - 32px))',
              background: 'var(--color-surface, #fff)',
              border: '1px solid var(--color-border, #e3e3e3)',
              borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,.25)',
              zIndex: 1001,
              padding: 22,
            }}
          >
            {options.title ? <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>{options.title}</h3> : null}
            <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-text, #222)' }}>{options.message}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <Button variant="secondary" onClick={() => settle(false)}>
                {options.cancelLabel ?? 'Annuler'}
              </Button>
              <Button variant={options.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
                {options.confirmLabel ?? 'Confirmer'}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </ConfirmContext.Provider>
  );
}
