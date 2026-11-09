import { Component, type ReactNode } from 'react';

function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Loading chunk|dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch/i.test(
    msg,
  );
}

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Évite la « page blanche » : capture toute erreur de rendu d'une page (crash
 * composant) ou d'un chunk lazy qui n'a pas pu se charger (déploiement récent,
 * coupure réseau). Un chunk manquant déclenche un rechargement unique pour
 * récupérer la version fraîche ; sinon un écran de secours propose de réessayer.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    if (isChunkLoadError(error)) {
      try {
        const key = 'edusenegal-chunk-reload';
        const last = Number(window.sessionStorage.getItem(key) ?? '0');
        if (Date.now() - last > 10_000) {
          window.sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      } catch {
        // sessionStorage indisponible (navigation privée) : on reste sur
        // l'écran de secours ci-dessous plutôt que de boucler.
      }
    }
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 32, maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>⚠️</div>
        <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Cette page n’a pas pu s’afficher</h2>
        <p style={{ color: 'var(--color-text-muted, #666)', margin: '0 0 14px', fontSize: 14, lineHeight: 1.5 }}>
          Une erreur est survenue. Réessayez, ou rechargez la page si le problème persiste.
        </p>
        {this.state.error?.message ? (
          <details style={{ textAlign: 'left', margin: '0 0 18px', fontSize: 12 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--color-text-muted, #888)' }}>Détail technique</summary>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: 'var(--color-surface-muted, #f6f6f8)',
                border: '1px solid var(--color-border, #e3e3e3)',
                borderRadius: 8,
                padding: 10,
                marginTop: 8,
                maxHeight: 180,
                overflow: 'auto',
                color: 'var(--color-text, #333)',
              }}
            >
              {this.state.error.message}
            </pre>
          </details>
        ) : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={this.reset}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--color-border, #ddd)',
              background: 'var(--color-surface, #fff)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-primary, #5b5bd6)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}
