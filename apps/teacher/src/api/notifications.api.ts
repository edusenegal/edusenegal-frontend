import { request } from './client';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string | null;
  /** `metadata.entityType` (backend) — ex. `service-note`, `expense`, `timetable`. */
  entityType?: string;
  /** Type backend (enum) — ex. `SERVICE_NOTE`, `TIMETABLE_CHANGED`. */
  type?: string;
}

export async function getMyNotifications(): Promise<NotificationItem[]> {
  const rows = await request<Array<Record<string, unknown>>>('/api/v1/notifications/my', {
    query: { page: 0, size: 20 },
  });
  return rows.map((r) => ({
    id: String(r.id ?? ''),
    title: String(r.title ?? ''),
    body: String(r.body ?? ''),
    read: Boolean(r.read),
    createdAt: (r.createdAt as string | null) ?? null,
    entityType: ((r.metadata ?? {}) as Record<string, unknown>).entityType
      ? String(((r.metadata ?? {}) as Record<string, unknown>).entityType)
      : undefined,
    type: r.type ? String(r.type) : undefined,
  }));
}

export async function getUnreadCount(): Promise<number> {
  const payload = await request<Record<string, unknown>>('/api/v1/notifications/my/unread-count');
  for (const value of Object.values(payload)) {
    if (typeof value === 'number') return value;
  }
  return 0;
}

export async function markAllNotificationsRead(): Promise<void> {
  await request('/api/v1/notifications/my/read-all', { method: 'PUT' });
}

/** Marque UNE notification comme lue. Backend : `PUT /api/v1/notifications/{id}/read`. */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await request(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PUT' });
}

// ── Port `NotificationsPort` (services / useServices) ──────────────────────
// Réintroduit : ce factory avait été écrasé en ajoutant la cloche FCM, ce qui
// cassait le build du teacher (`api/index.ts` importe `createNotificationsApi`,
// et NotificationsPage / DashboardPage consomment `services.notifications`).
// Les fonctions autonomes ci-dessus restent utilisées par NotificationsBell.
import type { AppNotification } from '@/types/domain';
import type { NotificationsPort } from '@/services/ports';

export function createNotificationsApi(): NotificationsPort {
  return {
    async mine(page = 0, size = 20): Promise<AppNotification[]> {
      const rows = await request<Array<Record<string, unknown>>>('/api/v1/notifications/my', {
        query: { page, size },
      });
      return rows.map((r) => ({
        id: String(r.id ?? ''),
        titre: String(r.title ?? ''),
        corps: String(r.body ?? ''),
        lue: Boolean(r.read),
        recueLe: String(r.createdAt ?? ''),
        entityType: ((r.metadata ?? {}) as Record<string, unknown>).entityType
          ? String(((r.metadata ?? {}) as Record<string, unknown>).entityType)
          : undefined,
      }));
    },
    unreadCount(): Promise<number> {
      return getUnreadCount();
    },
    async markRead(notificationId: string): Promise<void> {
      await request(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PUT' });
    },
    markAllRead(): Promise<void> {
      return markAllNotificationsRead();
    },
  };
}
