import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { config } from '@/app/config';
import { useAuthStore } from '@/stores/auth.store';
import type { MessageResponseDto } from '@/types/api';

/**
 * Client temps réel STOMP (messagerie instantanée).
 *
 * Un SEUL socket pour toute l'application : les écrans s'abonnent à un groupe
 * et reçoivent messages, accusés de lecture et indicateurs de frappe en
 * direct. Le jeton est relu à CHAQUE (re)connexion (`beforeConnect`), donc une
 * reconnexion après un rafraîchissement de session repart avec le jeton frais.
 * Les abonnements actifs sont ré-émis automatiquement à la reconnexion.
 */

export interface TypingEvent {
  groupId: string;
  userId: string;
  name: string;
  typing: boolean;
}
export interface ReadEvent {
  groupId: string;
  userId: string;
  at: string;
}
export interface GroupHandlers {
  onMessage?: (message: MessageResponseDto) => void;
  onRead?: (event: ReadEvent) => void;
  onTyping?: (event: TypingEvent) => void;
}

type Registration = { groupId: string; handlers: GroupHandlers; subs: StompSubscription[] };

let client: Client | null = null;
const registrations = new Set<Registration>();

function token(): string {
  return useAuthStore.getState().session?.accessToken ?? '';
}

function ensureClient(): Client | null {
  if (!config.wsUrl) return null;
  if (client) return client;

  client = new Client({
    brokerURL: config.wsUrl,
    reconnectDelay: 4000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    // Jeton relu à chaque connexion — jamais figé au premier montage.
    beforeConnect: () => {
      client!.connectHeaders = { Authorization: `Bearer ${token()}` };
    },
    onConnect: () => {
      // (Ré)abonne tous les groupes actifs — couvre la première connexion ET
      // chaque reconnexion après coupure réseau.
      registrations.forEach(subscribe);
    },
  });
  client.activate();
  return client;
}

function subscribe(reg: Registration): void {
  if (!client || !client.connected) return;
  // Purge d'anciens abonnements (reconnexion) avant de refaire.
  reg.subs.forEach((s) => {
    try {
      s.unsubscribe();
    } catch {
      /* socket déjà fermé */
    }
  });
  reg.subs = [];
  const { groupId, handlers } = reg;

  if (handlers.onMessage) {
    reg.subs.push(
      client.subscribe(`/topic/groups/${groupId}`, (frame: IMessage) => {
        try {
          handlers.onMessage!(JSON.parse(frame.body) as MessageResponseDto);
        } catch {
          /* trame non-JSON ignorée */
        }
      }),
    );
  }
  if (handlers.onRead) {
    reg.subs.push(
      client.subscribe(`/topic/groups/${groupId}/read`, (frame: IMessage) => {
        try {
          handlers.onRead!(JSON.parse(frame.body) as ReadEvent);
        } catch {
          /* ignore */
        }
      }),
    );
  }
  if (handlers.onTyping) {
    reg.subs.push(
      client.subscribe(`/topic/groups/${groupId}/typing`, (frame: IMessage) => {
        try {
          handlers.onTyping!(JSON.parse(frame.body) as TypingEvent);
        } catch {
          /* ignore */
        }
      }),
    );
  }
}

/**
 * Abonne un groupe. Renvoie la fonction de désabonnement. Le socket se connecte
 * au premier abonnement et se ferme quand plus aucun groupe n'est suivi.
 */
export function listenToGroup(groupId: string, handlers: GroupHandlers): () => void {
  const reg: Registration = { groupId, handlers, subs: [] };
  registrations.add(reg);
  const c = ensureClient();
  if (c && c.connected) subscribe(reg);

  return () => {
    reg.subs.forEach((s) => {
      try {
        s.unsubscribe();
      } catch {
        /* ignore */
      }
    });
    registrations.delete(reg);
    if (registrations.size === 0 && client) {
      client.deactivate();
      client = null;
    }
  };
}

/** Signale « en train d'écrire » au groupe (éphémère, non persisté). */
export function sendTyping(groupId: string, name: string, typing: boolean): void {
  if (!client || !client.connected) return;
  try {
    client.publish({
      destination: `/app/groups/${groupId}/typing`,
      body: JSON.stringify({ name, typing }),
    });
  } catch {
    /* socket indisponible : l'indicateur de frappe est best-effort */
  }
}
