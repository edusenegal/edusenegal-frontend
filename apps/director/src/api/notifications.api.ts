import { request, sessionContext } from './client';

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

/** Note de service du directeur → personnel ciblé (push + in-app). Backend :
 *  POST /api/v1/notifications/service-note (notification-service). */
export interface ServiceNotePayload {
  title: string;
  body: string;
  allStaff?: boolean;
  recipientIds?: string[];
}

export async function sendServiceNote(payload: ServiceNotePayload): Promise<void> {
  const { schoolId } = sessionContext();
  await request('/api/v1/notifications/service-note', {
    method: 'POST',
    body: { schoolId, ...payload },
  });
}
