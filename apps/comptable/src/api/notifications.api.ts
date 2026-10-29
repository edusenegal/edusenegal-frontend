import { request } from './client';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string | null;
  entityType?: string;
  entityId?: string;
}

export async function getMyNotifications(): Promise<NotificationItem[]> {
  const rows = await request<Array<Record<string, unknown>>>('/api/v1/notifications/my', {
    query: { page: 0, size: 20 },
  });
  return rows.map((r) => {
    const md = (r.metadata ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      body: String(r.body ?? ''),
      read: Boolean(r.read),
      createdAt: (r.createdAt as string | null) ?? null,
      entityType: md.entityType ? String(md.entityType) : undefined,
      entityId: md.entityId ? String(md.entityId) : undefined,
    };
  });
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
