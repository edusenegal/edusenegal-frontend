import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Badge, Button, Card, Input, StateView } from '@/components/ui';
import { request, sessionContext } from '@/api/client';
import { listenToGroup, sendTyping, type TypingEvent } from '@/api/realtime';

/**
 * Messagerie du personnel (espace direction).
 *
 * Le directeur voit le groupe « Personnel — Direction » (créé/garanti côté
 * backend dès l'ouverture) dont il est administrateur : il peut gérer les
 * membres (lecture seule / retrait). Temps réel via STOMP (voir `api/realtime`).
 * Page autonome : appelle `request` directement, sans passer par les ports DI.
 */

interface DtoGroup {
  id: string;
  name: string;
  type: string;
  unreadCount: number;
  admin: boolean;
  blocked: boolean;
  archived: boolean;
}
interface DtoMsg {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl: string | null;
  content: string;
  type: string;
  fileUrl: string | null;
  fileName: string | null;
  sentAt: string;
}
interface DtoMember {
  userId: string;
  name: string;
  photoUrl: string | null;
  admin: boolean;
  blocked: boolean;
}

interface Group {
  id: string;
  nom: string;
  nonLus: number;
  jeSuisAdmin: boolean;
  bloque: boolean;
}
interface Msg {
  id: string;
  auteurId: string;
  auteurNom: string;
  auteurPhotoUrl: string | null;
  contenu: string;
  envoyeLe: string;
  fichierUrl: string | null;
  fichierNom: string | null;
}
interface Member {
  userId: string;
  nom: string;
  photoUrl: string | null;
  admin: boolean;
  bloque: boolean;
}

function toMsg(d: DtoMsg): Msg {
  return {
    id: d.id,
    auteurId: d.senderId,
    auteurNom: d.senderName,
    auteurPhotoUrl: d.senderPhotoUrl ?? null,
    contenu: d.content,
    envoyeLe: d.sentAt,
    fichierUrl: d.fileUrl,
    fichierNom: d.fileName,
  };
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

async function fetchGroups(): Promise<Group[]> {
  const { schoolId } = sessionContext();
  const dtos = await request<DtoGroup[]>('/api/v1/groups/my', { query: { schoolId } });
  return dtos
    .filter((d) => !d.archived)
    .map((d) => ({ id: d.id, nom: d.name, nonLus: d.unreadCount, jeSuisAdmin: d.admin, bloque: d.blocked ?? false }));
}
async function fetchMessages(groupId: string): Promise<Msg[]> {
  const dtos = await request<DtoMsg[]>(`/api/v1/groups/${encodeURIComponent(groupId)}/messages`, {
    query: { page: 0, size: 30 },
  });
  return dtos.map(toMsg);
}
async function sendMessageApi(groupId: string, content: string): Promise<Msg> {
  const fd = new FormData();
  fd.append('type', 'TEXT');
  fd.append('content', content);
  const d = await request<DtoMsg>(`/api/v1/groups/${encodeURIComponent(groupId)}/messages`, {
    method: 'POST',
    formData: fd,
  });
  return toMsg(d);
}
async function markReadApi(groupId: string): Promise<void> {
  await request<void>(`/api/v1/groups/${encodeURIComponent(groupId)}/messages/read`, { method: 'PUT' });
}
async function fetchMembers(groupId: string): Promise<Member[]> {
  const dtos = await request<DtoMember[]>(`/api/v1/groups/${encodeURIComponent(groupId)}/members`);
  return dtos.map((m) => ({ userId: m.userId, nom: m.name, photoUrl: m.photoUrl ?? null, admin: m.admin, bloque: m.blocked }));
}
async function blockMemberApi(groupId: string, userId: string, block: boolean): Promise<void> {
  await request<void>(`/api/v1/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}/block`, {
    method: block ? 'POST' : 'DELETE',
  });
}
async function removeMemberApi(groupId: string, userId: string): Promise<void> {
  await request<void>(`/api/v1/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export default function MessagingPage() {
  const queryClient = useQueryClient();
  const myId = sessionContext().userId;

  const groupsQuery = useQuery({ queryKey: ['groups', 'mine'], queryFn: fetchGroups, refetchInterval: 30000 });
  const [groupId, setGroupId] = useState('');
  const [content, setContent] = useState('');
  const [typingName, setTypingName] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesQuery = useQuery({
    queryKey: ['messages', groupId],
    queryFn: () => fetchMessages(groupId),
    enabled: groupId !== '',
    refetchInterval: groupId !== '' ? 30000 : false,
  });

  const membersQuery = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => fetchMembers(groupId),
    enabled: membersOpen && groupId !== '',
  });

  function appendMessage(gId: string, msg: Msg) {
    queryClient.setQueryData<Msg[]>(['messages', gId], (old) => {
      const list = old ?? [];
      if (list.some((m) => m.id === msg.id)) return list;
      return [msg, ...list];
    });
  }

  useEffect(() => {
    if (!groupId) return;
    const stop = listenToGroup(groupId, {
      onMessage: (dto) => {
        appendMessage(groupId, toMsg(dto as unknown as DtoMsg));
        queryClient.invalidateQueries({ queryKey: ['groups', 'mine'] });
        if ((dto as { senderId?: string }).senderId !== myId) {
          markReadApi(groupId).catch(() => undefined);
        }
      },
      onTyping: (e: TypingEvent) => {
        if (e.userId === myId) return;
        setTypingName(e.typing ? e.name || 'Quelqu’un' : null);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        if (e.typing) typingClearRef.current = setTimeout(() => setTypingName(null), 3500);
      },
    });
    return () => {
      stop();
      setTypingName(null);
    };
  }, [groupId, myId]);

  const sendMutation = useMutation({
    mutationFn: () => sendMessageApi(groupId, content.trim()),
    onSuccess: (msg) => {
      setContent('');
      appendMessage(groupId, msg);
      sendTyping(groupId, '', false);
      queryClient.invalidateQueries({ queryKey: ['groups', 'mine'] });
    },
  });
  const markReadMutation = useMutation({
    mutationFn: (id: string) => markReadApi(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups', 'mine'] }),
  });
  const blockMut = useMutation({
    mutationFn: (v: { userId: string; block: boolean }) => blockMemberApi(groupId, v.userId, v.block),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'mine'] });
    },
  });
  const removeMut = useMutation({
    mutationFn: (userId: string) => removeMemberApi(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'mine'] });
    },
  });

  function onSelectGroup(id: string) {
    setGroupId(id);
    markReadMutation.mutate(id);
  }
  function onContentChange(value: string) {
    setContent(value);
    if (!groupId) return;
    if (!typingSentRef.current) {
      sendTyping(groupId, '', true);
      typingSentRef.current = setTimeout(() => {
        typingSentRef.current = null;
      }, 1200);
    }
  }
  function onSend() {
    if (!content.trim()) return;
    sendMutation.mutate();
  }

  const selectedGroup = groupsQuery.data?.find((g) => g.id === groupId);

  return (
    <div>
      <PageHeader title="Messagerie" subtitle="Groupe du personnel de l'établissement — messages instantanés." />
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        <Card padded>
          <StateView loading={groupsQuery.isLoading} error={groupsQuery.error} empty={groupsQuery.data?.length === 0}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(groupsQuery.data ?? []).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelectGroup(g.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: g.id === groupId ? 'var(--color-surface-muted)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{g.nom}</span>
                  {g.nonLus > 0 ? <Badge tone="danger">{g.nonLus}</Badge> : null}
                </button>
              ))}
            </div>
          </StateView>
        </Card>

        <Card padded>
          {groupId ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 10px' }}>
                <h3 style={{ fontSize: 14, margin: 0 }}>{selectedGroup?.nom}</h3>
                {selectedGroup?.jeSuisAdmin ? (
                  <Button size="sm" variant="secondary" onClick={() => setMembersOpen(true)}>
                    Gérer les membres
                  </Button>
                ) : null}
              </div>
              <StateView loading={messagesQuery.isLoading} error={messagesQuery.error} empty={messagesQuery.data?.length === 0}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
                  {(messagesQuery.data ?? [])
                    .slice()
                    .reverse()
                    .map((m) => (
                      <div key={m.id} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--color-surface-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={m.auteurNom} photoUrl={m.auteurPhotoUrl} size="sm" />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{m.auteurNom}</span>
                        </span>
                        <div style={{ fontSize: 13, marginTop: 2 }}>{m.contenu}</div>
                        {m.fichierUrl ? (
                          <a href={m.fichierUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                            📎 {m.fichierNom ?? 'Fichier'}
                          </a>
                        ) : null}
                        <div style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>{fmtTime(m.envoyeLe)}</div>
                      </div>
                    ))}
                </div>
              </StateView>
              <div style={{ minHeight: 18, fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', margin: '6px 2px 0' }}>
                {typingName ? `${typingName} est en train d’écrire…` : ''}
              </div>
              {selectedGroup?.bloque ? (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  🔒 Vous êtes en lecture seule dans ce groupe.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <Input
                    value={content}
                    onChange={(e) => onContentChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onSend();
                      }
                    }}
                    placeholder="Votre message…"
                    style={{ flex: 1 }}
                  />
                  <Button variant="primary" size="sm" loading={sendMutation.isPending} onClick={onSend}>
                    Envoyer
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Choisissez un groupe pour voir la conversation.</p>
          )}
        </Card>
      </div>

      {membersOpen ? (
        <div
          onClick={() => setMembersOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 20, width: 440, maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>Membres du groupe</strong>
              <Button size="sm" variant="ghost" onClick={() => setMembersOpen(false)}>Fermer</Button>
            </div>
            <StateView loading={membersQuery.isLoading} error={membersQuery.error} empty={(membersQuery.data ?? []).length === 0}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(membersQuery.data ?? []).map((m) => (
                  <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    <Avatar name={m.nom} photoUrl={m.photoUrl} size="sm" />
                    <span style={{ flex: 1, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {m.nom}
                      {m.admin ? <Badge tone="info">Admin</Badge> : null}
                      {m.bloque ? <Badge tone="warning">Lecture seule</Badge> : null}
                    </span>
                    {!m.admin && m.userId !== myId ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => blockMut.mutate({ userId: m.userId, block: !m.bloque })}>
                          {m.bloque ? 'Autoriser' : 'Lecture seule'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeMut.mutate(m.userId)}>Retirer</Button>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </StateView>
          </div>
        </div>
      ) : null}
    </div>
  );
}
