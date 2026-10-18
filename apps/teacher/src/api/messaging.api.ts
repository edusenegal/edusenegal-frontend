import { request, sessionContext } from '@/api/client';
import type { ApiGroupType, ApiMessageType, DiscussionGroupResponseDto, MessageResponseDto } from '@/types/api';
import type { MessagingPort } from '@/services/ports';
import type { DiscussionGroup, GroupKind, GroupMessage, MessageKind } from '@/types/domain';

const GROUP_KIND_FROM_API: Record<ApiGroupType, GroupKind> = {
  CLASS_GROUP: 'classe',
  STAFF_DIRECTOR: 'personnel',
  PARENT_TEACHER: 'parents',
  CUSTOM: 'personnalise',
};
const MESSAGE_KIND_TO_API: Record<MessageKind, ApiMessageType> = {
  texte: 'TEXT',
  fichier: 'FILE',
  annonce: 'ANNOUNCEMENT',
};

function fromGroupResponse(dto: DiscussionGroupResponseDto): DiscussionGroup {
  return {
    id: dto.id,
    nom: dto.name,
    type: GROUP_KIND_FROM_API[dto.type] ?? 'personnalise',
    nombreMembres: dto.memberCount,
    nonLus: dto.unreadCount,
    dernierMessageLe: dto.lastMessageAt,
    jeSuisAdmin: dto.admin,
    archive: dto.archived,
  };
}

function fromMessageResponse(dto: MessageResponseDto): GroupMessage {
  const kindFromApi: Record<string, MessageKind> = { TEXT: 'texte', FILE: 'fichier', ANNOUNCEMENT: 'annonce' };
  return {
    id: dto.id,
    auteurId: dto.senderId,
    auteurNom: dto.senderName,
    contenu: dto.content,
    type: kindFromApi[dto.type] ?? 'texte',
    fichierUrl: dto.fileUrl,
    fichierNom: dto.fileName,
    envoyeLe: dto.sentAt,
    luParMoi: dto.readBy.includes(sessionContext().userId),
  };
}

/** Groupes de discussion et messagerie — `messaging-service`, `/api/v1/groups`. */
export function createMessagingApi(): MessagingPort {
  return {
    async myGroups(): Promise<DiscussionGroup[]> {
      const { schoolId } = sessionContext();
      const dtos = await request<DiscussionGroupResponseDto[]>('/api/v1/groups/my', { query: { schoolId } });
      return dtos.map(fromGroupResponse);
    },

    async messages(groupId, page = 0, size = 30): Promise<GroupMessage[]> {
      const dtos = await request<MessageResponseDto[]>(`/api/v1/groups/${encodeURIComponent(groupId)}/messages`, {
        query: { page, size },
      });
      return dtos.map(fromMessageResponse);
    },

    async send(groupId, input): Promise<GroupMessage> {
      const formData = new FormData();
      formData.append('type', MESSAGE_KIND_TO_API[input.type]);
      if (input.contenu) {
        formData.append('content', input.contenu);
      }
      if (input.fichier) {
        formData.append('file', input.fichier);
      }
      const dto = await request<MessageResponseDto>(`/api/v1/groups/${encodeURIComponent(groupId)}/messages`, {
        method: 'POST',
        formData,
      });
      return fromMessageResponse(dto);
    },

    async markRead(groupId): Promise<void> {
      await request<void>(`/api/v1/groups/${encodeURIComponent(groupId)}/messages/read`, { method: 'PUT' });
    },
  };
}
