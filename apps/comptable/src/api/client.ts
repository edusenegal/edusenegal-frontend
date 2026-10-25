import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { config } from '@/app/config';
import { AppError, kindFromStatus, messageFor, toAppError } from '@/services/errors';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiErrorDto, LoginResponseDto } from '@/types/api';

// Doit rester SUPÉRIEUR au budget de la passerelle, sinon le navigateur
// abandonne avant que le serveur ait répondu et l'écran affiche « le serveur
// met trop de temps » à la place du vrai motif. Budget le plus long côté
// gateway : le TimeLimiter du client Feign de connexion, 15 s (démarrage à
// froid de user-service inclus). Même valeur que `student/web`.
const TIMEOUT_MS = 20_000;

/** Propriétés propres à cette application, portées par la config Axios de bout en bout. */
interface RequestExtras {
  /** Un appel public (login, refresh) n'attache pas le jeton et ne déclenche jamais de rafraîchissement sur 401. */
  anonymous?: boolean;
  /** Posé par l'intercepteur de réponse après le premier nouvel essai — jamais un deuxième. */
  _retried?: boolean;
  /** Numéro de séquence — pour retrouver la réponse d'un appel dans une console qui en mêle plusieurs. */
  _seq?: number;
  /** Horodatage de départ (`performance.now()`) — pour la durée affichée dans `[API←]`/`[API✗]`. */
  _startedAt?: number;
}

type RequestConfig = InternalAxiosRequestConfig & RequestExtras;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Corps multipart — Axios pose lui-même le Content-Type (boundary compris). */
  formData?: FormData;
  query?: Record<string, string | number | undefined>;
  anonymous?: boolean;
  /**
   * `blob` pour un endpoint qui rend un fichier — un PDF de bulletin, par
   * exemple. Le jeton reste attaché : un fichier authentifié ne peut pas
   * être servi par un simple lien.
   */
  responseType?: 'json' | 'blob';
  signal?: AbortSignal;
}

const axiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: TIMEOUT_MS,
});

// CORRECTION — journalisation des appels API, demandée pour diagnostiquer
// les écrans qui restent vides côté frontend alors que Postman obtient de
// vraies réponses : méthode, URL, corps envoyé, statut et corps reçu.
// Jamais l'en-tête Authorization.
//
// CORRECTION (demande explicite, répétée) — active par défaut en
// développement (import.meta.env.DEV), mais un déploiement (démo, école
// pilote...) où le bug ne se reproduit QUE là n'est jamais lancé avec
// `npm run dev` : y rester muet rendait cette journalisation inutile
// exactement là où elle servirait. Activable sans reconstruire depuis la
// console du navigateur : localStorage.setItem('edusenegal:debug-api', '1')
// (recharger la page ; retirer l'entrée pour revenir au silence par
// défaut). Lu à chaque appel, pas une seule fois au chargement du module,
// pour ne jamais exiger un rechargement supplémentaire après l'avoir posé.
function apiLogEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem('edusenegal:debug-api') === '1';
  } catch {
    // Stockage indisponible (navigation privée, quota...) : silence, comme
    // si le drapeau n'était pas posé -- jamais une erreur qui remonte.
    return false;
  }
}

function shortLog(data: unknown): unknown {
  if (typeof data !== 'string') {
    return data;
  }
  return data.length > 2000 ? `${data.slice(0, 2000)}…` : data;
}

/** `#3`, éventuellement suivi de `↻` pour le nouvel essai posté après un rafraîchissement de jeton. */
function tag(seq: number | undefined, retried: boolean | undefined): string {
  return `#${seq ?? '?'}${retried ? '↻' : ''}`;
}

function logRequest(seq: number | undefined, retried: boolean | undefined, method: string, url: string, body: unknown): void {
  if (!apiLogEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(`[API→ ${tag(seq, retried)}] ${method} ${url}`, body !== undefined ? { body: shortLog(body) } : '');
}

function logResponse(
  seq: number | undefined,
  retried: boolean | undefined,
  durationMs: number,
  method: string,
  url: string,
  status: number,
  data: unknown,
): void {
  if (!apiLogEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(`[API← ${tag(seq, retried)}] ${status} ${method} ${url} (${durationMs.toFixed(0)} ms)`, shortLog(data));
}

function logError(seq: number | undefined, retried: boolean | undefined, durationMs: number, method: string, url: string, error: unknown): void {
  if (!apiLogEnabled()) return;
  console.error(`[API✗ ${tag(seq, retried)}] ${method} ${url} (${durationMs.toFixed(0)} ms)`, error);
}

function describeRequest(cfg: AxiosRequestConfig | undefined): { method: string; url: string } {
  const method = (cfg?.method ?? 'GET').toUpperCase();
  const base = (cfg?.baseURL ?? config.apiBaseUrl).replace(/\/$/, '');
  let url = `${base}${cfg?.url ?? ''}`;
  const params = cfg?.params as Record<string, unknown> | undefined;
  if (params && Object.keys(params).length > 0) {
    // CORRECTION — les appels avec `query` (pagination, filtres…) se
    // journalisaient sans leurs paramètres : impossible de distinguer
    // `GET /classes` de `GET /classes?schoolId=…` dans la console.
    url += `?${new URLSearchParams(params as Record<string, string>).toString()}`;
  }
  return { method, url };
}

/** Traduit une erreur Axios en `AppError` — jamais le message brut du backend affiché tel quel. */
function toAxiosAppError(error: AxiosError): AppError {
  const response = error.response;
  if (!response) {
    // Pas de réponse du tout : délai dépassé ou réseau indisponible selon le code Axios.
    if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
      return new AppError('timeout', messageFor('timeout'));
    }
    return new AppError('network', messageFor('network'), null, error.message);
  }

  const kind = kindFromStatus(response.status);
  let detail: string | null = null;
  let code: string | null = null;
  const data = response.data as ApiErrorDto | undefined;
  if (data && typeof data === 'object') {
    detail = data.message ?? data.error ?? null;
    code = data.code ?? null;
  }
  // CORRECTION (bug signalé) : l'approbation d'une dépense échoue sans que
  // le comptable en sache la raison (solde de l'école insuffisant). Message
  // d'exception : ce code métier précis est une phrase déjà pensée pour
  // l'utilisateur final côté backend (jamais une trace technique), donc on
  // l'affiche telle quelle plutôt que le message générique "Vérifiez le
  // formulaire" qui ne correspond à rien ici (aucun champ n'est en cause).
  if (data?.code === 'INSUFFICIENT_FUNDS' && data.message) {
    return new AppError('validation', data.message, response.status, detail);
  }
  // Le message affiché reste le nôtre : celui du backend part dans `detail`,
  // pour les journaux, sans exposer de trace technique à la direction.
  return new AppError(kind, messageFor(kind), response.status, detail, code);
}

/**
 * Un seul rafraîchissement à la fois.
 *
 * Sans ce verrou, plusieurs requêtes simultanées qui reçoivent 401
 * déclencheraient autant de rafraîchissements concurrents, dont tous sauf le
 * premier invalideraient le jeton qui vient d'être émis.
 */
let refreshInFlight: Promise<LoginResponseDto> | null = null;

/** Numéro de séquence global, croissant — attribué une seule fois par appel logique (survit au nouvel essai après rafraîchissement). */
let requestSeq = 0;

async function refreshSession(): Promise<LoginResponseDto> {
  const session = useAuthStore.getState().session;
  if (!session?.refreshToken) {
    throw new AppError('unauthorized', messageFor('unauthorized'), 401);
  }

  refreshInFlight ??= rawRequest<LoginResponseDto>('/api/v1/auth/refresh', {
    method: 'POST',
    // `accessToken`, même périmé, permet au backend de retrouver l'école
    // active de la session plutôt que de revenir à l'école par défaut du
    // compte — utile à un directeur rattaché à plusieurs établissements.
    body: { refreshToken: session.refreshToken, accessToken: session.accessToken },
    anonymous: true,
  }).finally(() => {
    refreshInFlight = null;
  });

  const tokens = await refreshInFlight;
  useAuthStore.getState().updateTokens(tokens);
  return tokens;
}

axiosInstance.interceptors.request.use((cfg) => {
  const rc = cfg as RequestConfig;
  if (!rc.anonymous) {
    const token = useAuthStore.getState().session?.accessToken;
    if (token) {
      rc.headers.set('Authorization', `Bearer ${token}`);
    }
  }
  // `_seq` ne se pose qu'une fois : le nouvel essai après rafraîchissement
  // repasse par cet intercepteur avec le MÊME `cfg` (`_seq` déjà posé), pour
  // que la console associe sans ambiguïté la requête, sa reprise et leurs
  // réponses respectives — `_startedAt`, lui, redémarre à chaque passage,
  // pour que la durée affichée soit celle de CET essai, pas du cumul.
  rc._seq ??= ++requestSeq;
  rc._startedAt = performance.now();
  const { method, url } = describeRequest(rc);
  logRequest(rc._seq, rc._retried, method, url, rc.data instanceof FormData ? '[FormData]' : rc.data);
  return rc;
});

axiosInstance.interceptors.response.use(
  (response) => {
    const rc = response.config as RequestConfig;
    const { method, url } = describeRequest(rc);
    const durationMs = performance.now() - (rc._startedAt ?? performance.now());
    logResponse(rc._seq, rc._retried, durationMs, method, url, response.status, response.data);
    return response;
  },
  async (error: unknown) => {
    const axiosError = error as AxiosError;
    const original = axiosError.config as RequestConfig | undefined;
    const { method, url } = describeRequest(original);
    const durationMs = performance.now() - (original?._startedAt ?? performance.now());
    const appError = toAxiosAppError(axiosError);
    logError(original?._seq, original?._retried, durationMs, method, url, appError);

    if (!original || appError.kind !== 'unauthorized' || original.anonymous || original._retried) {
      throw appError;
    }

    try {
      await refreshSession();
    } catch {
      useAuthStore.getState().clear();
      throw appError;
    }

    original._retried = true;
    try {
      // Repasse par l'instance Axios, donc par les deux intercepteurs : le
      // nouvel essai repart avec le jeton frais, et un nouvel échec est
      // retraduit en `AppError` par ce même intercepteur — `_retried` étant
      // déjà posé, il ne boucle pas une seconde fois.
      return await axiosInstance.request(original);
    } catch (retryError) {
      if (retryError instanceof AppError && retryError.kind === 'unauthorized') {
        useAuthStore.getState().clear();
      }
      throw retryError;
    }
  },
);

async function rawRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', body, formData, query, anonymous = false, signal, responseType = 'json' } = options;

  const params: Record<string, string> = {};
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        params[key] = String(value);
      }
    }
  }

  try {
    const response = await axiosInstance.request<T>({
      url: path,
      method,
      params: Object.keys(params).length ? params : undefined,
      data: formData ?? body,
      headers: !formData && body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      responseType: responseType === 'blob' ? 'blob' : 'json',
      signal,
      ...({ anonymous } satisfies RequestExtras),
    });
    return response.data;
  } catch (error) {
    throw toAppError(error);
  }
}

/**
 * Requête authentifiée.
 *
 * La reprise après expiration (rafraîchissement puis un seul nouvel essai)
 * vit dans l'intercepteur de réponse ci-dessus, pas ici : un appel passé
 * directement à `axiosInstance` (comme le nouvel essai lui-même) en
 * bénéficie donc aussi, sans code dupliqué.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return rawRequest<T>(path, options);
}

/** Contexte de session lu par les services — évite de le passer partout. */
export function sessionContext(): { userId: string; schoolId: string } {
  const session = useAuthStore.getState().session;
  return {
    userId: session?.userId ?? '',
    schoolId: session?.schoolId ?? '',
  };
}
