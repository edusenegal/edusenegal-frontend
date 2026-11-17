import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Badge, Button, Card, Input, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { sessionContext } from '@/api/client';
import { fromMessageResponse } from '@/api/messaging.api';
import { listenToGroup, sendTyping, type TypingEvent } from '@/api/realtime';
import type { GroupMessage } from '@/types/domain';

/**
 * Messagerie instantanée (temps réel STOMP).
 *
 * Les nouveaux messages, accusés de lecture et indicateurs de frappe arrivent
 * en direct par WebSocket (voir `api/realtime.ts`). Le `refetchInterval` ne
 * sert plus que de filet de sécurité (reconnexion manquée, onglet resté
 * ouvert hors ligne), d'où un intervalle long et non plus 5 s.
 */
export default function MessagingPage() {
  const { messaging } = useServices();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const myId = sessionContext().userId;

  const groupsQuery = useQuery({ queryKey: ['groups', 'mine'], queryFn: () => messaging.myGroups(), refetchInterval: 30000 });
  const [groupId, setGroupId] = useState('');
  const [content, setContent] = useState('');
  const [typingName, setTypingName] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupMessage | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);

  const membersQuery = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => messaging.members(groupId),
    enabled: membersOpen && groupId !== '',
  });
  const blockMut = useMutation({
    mutationFn: (v: { userId: string; block: boolean }) =>
      v.block ? messaging.blockMember(groupId, v.userId) : messaging.unblockMember(groupId, v.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'mine'] });
    },
  });
  const removeMut = useMutation({
    mutationFn: (userId: string) => messaging.removeMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'mine'] });
    },
  });
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesQuery = useQuery({
    queryKey: ['messages', groupId],
    queryFn: () => messaging.messages(groupId),
    enabled: groupId !== '',
    refetchInterval: groupId !== '' ? 30000 : false,
  });

  /** Ajoute un message en tête (liste triée du plus récent au plus ancien), sans doublon. */
  function appendMessage(gId: string, msg: GroupMessage) {
    queryClient.setQueryData<GroupMessage[]>(['messages', gId], (old) => {
      const list = old ?? [];
      if (list.some((m) => m.id === msg.id)) return list;
      return [msg, ...list];
    });
  }

  // Abonnement temps réel au groupe ouvert.
  useEffect(() => {
    if (!groupId) return;
    const stop = listenToGroup(groupId, {
      onMessage: (dto) => {
        appendMessage(groupId, fromMessageResponse(dto));
        // Rafraîchit les compteurs (non-lus, dernier message) de la liste.
        queryClient.invalidateQueries({ queryKey: ['groups', 'mine'] });
        // Le fil est ouvert : marque lu immédiatement si le message vient d'un autre.
        if (dto.senderId !== myId) {
          messaging.markRead(groupId).catch(() => undefined);
        }
      },
      onTyping: (e: TypingEvent) => {
        if (e.userId === myId) return;
        setTypingName(e.typing ? e.name || 'Quelqu’un' : null);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        if (e.typing) {
          typingClearRef.current = setTimeout(() => setTypingName(null), 3500);
        }
      },
      onRead: () => queryClient.invalidateQueries({ queryKey: ['groups', 'mine'] }),
    });
    return () => {
      stop();
      setTypingName(null);
    };
  }, [groupId, myId]);

  const sendMutation = useMutation({
    mutationFn: () => messaging.send(groupId, { contenu: content.trim(), type: 'texte' }),
    onSuccess: (msg) => {
      setContent('');
      appendMessage(groupId, msg); // écho local instantané (dédupliqué avec la trame STOMP)
      sendTyping(groupId, '', false);
      queryClient.invalidateQueries({ queryKey: ['groups', 'mine'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => messaging.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups', 'mine'] }),
  });

  function onSelectGroup(id: string) {
    setGroupId(id);
    markReadMutation.mutate(id);
  }

  function onContentChange(value: string) {
    setContent(value);
    if (!groupId) return;
    // Throttle de l'indicateur de frappe : une trame « typing » au plus toutes
    // les 1,2 s, puis « stop » après inactivité.
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
      <PageHeader title="Messagerie" subtitle="Groupes de classe, personnel et parents — messages instantanés." />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                  {(messagesQuery.data ?? [])
                    .slice()
                    .reverse()
                    .map((m) => (
                      <div key={m.id} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--color-surface-muted)' }}>
                        <button
                          type="button"
                          onClick={() => setDetail(m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                        >
                          <Avatar name={m.auteurNom} photoUrl={m.auteurPhotoUrl} size="sm" />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{m.auteurNom}</span>
                        </button>
                        <div style={{ fontSize: 13, marginTop: 2 }}>{m.contenu}</div>
                        {m.fichierUrl ? (
                          <a href={m.fichierUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                            📎 {m.fichierNom ?? 'Fichier'}
                          </a>
                        ) : null}
                        <div style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>{m.envoyeLe}</div>
                      </div>
                    ))}
                </div>
              </StateView>
              <div style={{ minHeight: 18, fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic', margin: '6px 2px 0' }}>
                {typingName ? `${typingName} est en train d’écrire…` : ''}
              </div>
              {selectedGroup?.bloque ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--color-surface-muted)',
                    color: 'var(--color-text-muted)',
                    fontSize: 13,
                  }}
                >
                  🔒 Vous êtes en lecture seule dans ce groupe : vous pouvez lire les messages mais pas en envoyer.
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
            <StateView
              loading={membersQuery.isLoading}
              error={membersQuery.error}
              empty={(membersQuery.data ?? []).length === 0}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(membersQuery.data ?? []).map((m) => (
                  <div
                    key={m.userId}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 8 }}
                  >
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
      {detail ? (
        <div
          onClick={() => setDetail(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--color-surface)', borderRadius: 12, padding: 24, minWidth: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
          >
            <Avatar name={detail.auteurNom} photoUrl={detail.auteurPhotoUrl} size="md" />
            <div style={{ fontSize: 16, fontWeight: 700 }}>{detail.auteurNom}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Membre du groupe</div>
            <Button variant="secondary" size="sm" onClick={() => setDetail(null)}>Fermer</Button>
          </div>
        </div>
      ) : null}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} />
    </div>
  );
}
