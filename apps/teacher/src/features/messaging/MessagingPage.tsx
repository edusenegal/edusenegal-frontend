import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Input, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';

export default function MessagingPage() {
  const { messaging } = useServices();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const groupsQuery = useQuery({ queryKey: ['groups', 'mine'], queryFn: () => messaging.myGroups(), refetchInterval: 15000 });
  const [groupId, setGroupId] = useState('');
  const [content, setContent] = useState('');

  const messagesQuery = useQuery({
    queryKey: ['messages', groupId],
    queryFn: () => messaging.messages(groupId),
    enabled: groupId !== '',
    refetchInterval: groupId !== '' ? 5000 : false,
  });

  const sendMutation = useMutation({
    mutationFn: () => messaging.send(groupId, { contenu: content.trim(), type: 'texte' }),
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['messages', groupId] });
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

  function onSend() {
    if (!content.trim()) {
      return;
    }
    sendMutation.mutate();
  }

  const selectedGroup = groupsQuery.data?.find((g) => g.id === groupId);

  return (
    <div>
      <PageHeader title="Messagerie" subtitle="Groupes de classe, personnel et parents." />
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
              <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>{selectedGroup?.nom}</h3>
              <StateView loading={messagesQuery.isLoading} error={messagesQuery.error} empty={messagesQuery.data?.length === 0}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                  {(messagesQuery.data ?? [])
                    .slice()
                    .reverse()
                    .map((m) => (
                      <div key={m.id} style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--color-surface-muted)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{m.auteurNom}</div>
                        <div style={{ fontSize: 13 }}>{m.contenu}</div>
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
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Votre message…" style={{ flex: 1 }} />
                <Button variant="primary" size="sm" loading={sendMutation.isPending} onClick={onSend}>
                  Envoyer
                </Button>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Choisissez un groupe pour voir la conversation.</p>
          )}
        </Card>
      </div>
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} />
    </div>
  );
}
