import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';

/**
 * Config Firebase du build — valeurs PUBLIQUES injectées par Vite
 * (`VITE_FIREBASE_*`, voir `.env.example`). Le push ne s'active que si elles
 * sont toutes présentes ; sinon l'application fonctionne normalement, sans push.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

/** Clé VAPID (push web) — onglet « Cloud Messaging » de la console Firebase. */
export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export function isPushConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      firebaseConfig.messagingSenderId &&
      vapidKey,
  );
}

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

/** Retourne l'instance Messaging si tout est configuré ET le navigateur compatible, sinon null. */
export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (!isPushConfigured()) return null;
  try {
    if (!(await isSupported())) return null;
    app ??= initializeApp({
      apiKey: firebaseConfig.apiKey!,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId!,
      messagingSenderId: firebaseConfig.messagingSenderId!,
      appId: firebaseConfig.appId!,
    });
    messaging ??= getMessaging(app);
    return messaging;
  } catch {
    return null;
  }
}
