/**
 * Erreurs applicatives.
 *
 * L'interface ne doit jamais afficher un message technique : chaque erreur
 * porte un `kind` que les composants traduisent en état d'écran (401 →
 * redirection, 403 → écran interdit, réseau → bouton « Réessayer »).
 *
 * Sur la branche `mock`, aucune de ces erreurs n'est levée en pratique (les
 * services mock résolvent toujours) — le type reste là pour que la branche
 * `api` n'ait rien à changer à `StateView` ni aux écrans.
 */

export type ErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'validation'
  | 'server'
  | 'unknown';

export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly status: number | null;
  /** Détail technique conservé pour les journaux, jamais affiché tel quel. */
  readonly detail: string | null;

  constructor(kind: ErrorKind, message: string, status: number | null = null, detail: string | null = null) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

const MESSAGES: Record<ErrorKind, string> = {
  network: 'Connexion impossible. Vérifiez votre connexion internet et réessayez.',
  timeout: 'Le serveur met trop de temps à répondre. Réessayez dans un instant.',
  unauthorized: 'Votre session a expiré. Reconnectez-vous pour continuer.',
  forbidden: "Vous n'avez pas accès à cette page.",
  notFound: 'Cette information est introuvable.',
  validation: 'Certaines informations sont incorrectes. Vérifiez le formulaire.',
  server: 'Le service est momentanément indisponible. Réessayez dans quelques minutes.',
  unknown: 'Une erreur est survenue. Réessayez, et signalez-le si cela persiste.',
};

export function kindFromStatus(status: number): ErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 400 || status === 422) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
}

export function messageFor(kind: ErrorKind): string {
  return MESSAGES[kind];
}

/** Traduit n'importe quoi en AppError — y compris ce qui n'est pas une Error. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new AppError('timeout', MESSAGES.timeout);
  }
  if (error instanceof TypeError) {
    return new AppError('network', MESSAGES.network, null, error.message);
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new AppError('unknown', MESSAGES.unknown, null, detail);
}
