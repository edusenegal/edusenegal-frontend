/**
 * Configuration d'exécution, lue une seule fois au démarrage.
 * Aucune autre partie du code ne lit `import.meta.env` directement : cela
 * garde les valeurs typées et testables — voir `.env.example`.
 */

interface AppConfig {
  readonly apiBaseUrl: string;
  /** Base WebSocket temps réel (messagerie), ex. wss://realtime.senetude.com/ws. */
  readonly wsUrl: string;
  readonly assetsBaseUrl: string;
  /** Marge, en secondes, avant expiration à partir de laquelle on rafraîchit. */
  readonly tokenRefreshMargin: number;
  readonly isProduction: boolean;
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * URL WebSocket du temps réel (messagerie STOMP).
 *
 * La passerelle est en `spring-cloud-gateway-mvc` (servlet) et ne relaie pas
 * l'upgrade WebSocket : le temps réel est exposé par un endpoint dédié
 * (messaging-service, sous-domaine `realtime.<domaine>`). On privilégie
 * `VITE_WS_URL` ; à défaut on dérive de l'API (`api-services.` -> `realtime.`),
 * ce qui couvre la production. En développement local, poser
 * `VITE_WS_URL=ws://localhost:8089/ws` (le messaging-service en direct).
 */
function resolveWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;
  const api = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!api) return '';
  try {
    const u = new URL(api);
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = u.host.replace(/^api-services\./, 'realtime.');
    return `${proto}//${host}/ws`;
  } catch {
    return '';
  }
}

export const config: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  wsUrl: resolveWsUrl(),
  assetsBaseUrl: import.meta.env.VITE_ASSETS_BASE_URL ?? '',
  tokenRefreshMargin: readNumber(import.meta.env.VITE_TOKEN_REFRESH_MARGIN, 60),
  isProduction: import.meta.env.PROD,
};

/**
 * school-service renvoie des clés d'objet MinIO relatives
 * ("schools/<slug>/logo.png"), pas des URL absolues.
 */
export function assetUrl(key: string | null | undefined): string | null {
  if (!key) {
    return null;
  }
  if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('data:')) {
    return key;
  }
  const base = config.assetsBaseUrl.replace(/\/$/, '');
  const path = key.replace(/^\//, '');
  return base ? `${base}/${path}` : `/${path}`;
}
