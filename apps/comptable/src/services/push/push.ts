import { deleteToken, getToken, onMessage } from 'firebase/messaging';
import { request } from '@/api/client';
import { getMessagingIfSupported, vapidKey } from './firebase';

let currentToken: string | null = null;
let foregroundBound = false;

/** Enregistre le jeton d'appareil (push) pour l'utilisateur connecté. */
export async function registerPush(): Promise<void> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return;
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'denied') return;
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (token) {
      currentToken = token;
      await request('/api/v1/users/me/device-tokens', {
        method: 'POST',
        body: { token, platform: 'web' },
      });
    }

    if (!foregroundBound) {
      foregroundBound = true;
      // Onglet au premier plan : FCM n'affiche rien, on relaie manuellement.
      onMessage(messaging, (payload) => {
        const n = payload.notification;
        if (n && Notification.permission === 'granted') {
          new Notification(n.title ?? 'EduSénégal', { body: n.body ?? '', icon: '/favicon.ico' });
        }
      });
    }
  } catch {
    // Push indisponible : jamais bloquant.
  }
}

/** Invalide le jeton (FCM + backend). À l'ouverture d'une autre session, le
 * backend réattribue de toute façon ce jeton au nouveau compte. */
export async function unregisterPush(): Promise<void> {
  const token = currentToken;
  currentToken = null;
  // 1) Invalider au niveau FCM : stoppe toute livraison même si le DELETE
  //    authentifié échoue (session déjà fermée). Le backend purge le jeton
  //    périmé au prochain envoi.
  try {
    const messaging = await getMessagingIfSupported();
    if (messaging) await deleteToken(messaging);
  } catch {
    /* ignore */
  }
  // 2) Retrait explicite côté backend tant que la session vaut encore.
  if (token) {
    try {
      await request('/api/v1/users/me/device-tokens', { method: 'DELETE', query: { token } });
    } catch {
      /* best effort */
    }
  }
}
