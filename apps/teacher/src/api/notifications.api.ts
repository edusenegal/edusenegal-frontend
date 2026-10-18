import { request } from '@/api/client';
import type { NotificationResponseDto } from '@/types/api';
import type { NotificationsPort } from '@/services/ports';
import type { AppNotification } from '@/types/domain';

function fromNotificationResponse(dto: NotificationResponseDto): AppNotification {
  return {
    id: dto.id,
    titre: dto.title,
    corps: dto.body,
    lue: dto.read,
    recueLe: dto.createdAt,
  };
}

/** Notifications du professeur connecté — `notification-service`, `/api/v1/notifications`. */
export function createNotificationsApi(): NotificationsPort {
  return {
    async mine(page = 0, size = 20): Promise<AppNotification[]> {
      const dtos = await request<NotificationResponseDto[]>('/api/v1/notifications/my', { query: { page, size } });
      return dtos.map(fromNotificationResponse);
    },

    async unreadCount(): Promise<number> {
      const result = await request<{ count: number }>('/api/v1/notifications/my/unread-count');
      return result.count;
    },

    async markRead(notificationId): Promise<void> {
      await request<void>(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PUT' });
    },

    async markAllRead(): Promise<void> {
      await request<void>('/api/v1/notifications/my/read-all', { method: 'PUT' });
    },
  };
}
