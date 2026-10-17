/**
 * Configuration d'exécution, lue une seule fois au démarrage.
 * Aucune autre partie du code ne lit `import.meta.env` directement : cela
 * garde les valeurs typées et testables — voir `.env.example`.
 */

interface AppConfig {
  readonly apiBaseUrl: string;
  readonly assetsBaseUrl: string;
  /** Marge, en secondes, avant expiration à partir de laquelle on rafraîchit. */
  readonly tokenRefreshMargin: number;
  readonly isProduction: boolean;
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
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
