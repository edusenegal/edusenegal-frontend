import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { config } from '@/app/config';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Client temps réel STOMP (messagerie). Un seul socket pour l'app ; les écrans
 * s'abonnent à un groupe et reçoivent messages et indicateurs de frappe en
 * direct. Jeton relu à chaque (re)connexion ; abonnements ré-émis à la reconnexion.
 */
export interface TypingEvent {
  groupId: string;
  userId: string;
  name: string;
  typing: boolean;
}
export interface GroupHandlers {
  onMessage?: (message: Record<string, unknown>) => void;
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
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    beforeConnect: () => {
      client!.connectHeaders = { Authorization: `Bearer ${token()}` };
    },
    onConnect: () => registrations.forEach(subscribe),
  });
  client.activate();
  return client;
}

function subscribe(reg: Registration): void {
  if (!client || !client.connected) return;
  reg.subs.forEach((s) => {
    try {
      s.unsubscribe();
    } catch {
      /* ignore */
    }
  });
  reg.subs = [];
  const { groupId, handlers } = reg;
  if (handlers.onMessage) {
    reg.subs.push(
      client.subscribe(`/topic/groups/${groupId}`, (frame: IMessage) => {
        try {
          handlers.onMessage!(JSON.parse(frame.body) as Record<string, unknown>);
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

export function sendTyping(groupId: string, name: string, typing: boolean): void {
  if (!client || !client.connected) return;
  try {
    client.publish({ destination: `/app/groups/${groupId}/typing`, body: JSON.stringify({ name, typing }) });
  } catch {
    /* best-effort */
  }
}
