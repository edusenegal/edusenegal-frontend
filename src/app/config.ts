/**
 * Configuration d'exécution, lue une seule fois au démarrage.
 * Aucune autre partie du code ne lit `import.meta.env` directement : cela
 * garde les valeurs typées et testables, et prépare la branche `api`
 * (ces variables ne sont utilisées que là — voir `.env.example`).
 */

interface AppConfig {
  readonly apiBaseUrl: string;
  readonly assetsBaseUrl: string;
  readonly isProduction: boolean;
}

export const config: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  assetsBaseUrl: import.meta.env.VITE_ASSETS_BASE_URL ?? '',
  isProduction: import.meta.env.PROD,
};
