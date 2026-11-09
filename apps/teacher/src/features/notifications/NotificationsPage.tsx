import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { AppNotification } from '@/types/domain';

export default function NotificationsPage() {
  const { notifications } = useServices();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<AppNotification | null>(null);
  const list = useQuery({ queryKey: ['notifications', 'mine'], queryFn: () => notifications.mine() });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notifications.markRead(id),
    onSuccess: invalidate,
  });
  const markAllMutation = useMutation({
    mutationFn: () => notifications.markAllRead(),
    onSuccess: invalidate,
  });

  function openNote(n: AppNotification) {
    if (!n.lue) markReadMutation.mutate(n.id);
    setDetail(n);
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Annonces et alertes reçues."
        action={
          <Button variant="secondary" size="sm" loading={markAllMutation.isPending} onClick={() => markAllMutation.mutate()}>
            Tout marquer comme lu
          </Button>
        }
      />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(list.data ?? []).map((n) => {
              const isNote = n.entityType === 'service-note';
              return (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 0',
                    borderTop: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    role={isNote ? 'button' : undefined}
                    onClick={isNote ? () => openNote(n) : undefined}
                    style={{ cursor: isNote ? 'pointer' : 'default', flex: 1 }}
                  >
                    <div style={{ fontWeight: n.lue ? 400 : 700 }}>{n.titre}</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--color-text-muted)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {n.corps}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>{n.recueLe}</div>
                    {isNote ? (
                      <div style={{ fontSize: 11.5, color: 'var(--color-primary)', marginTop: 4 }}>Voir le détail →</div>
                    ) : null}
                  </div>
                  {n.lue ? (
                    <Badge tone="neutral">Lu</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate(n.id)}>
                      Marquer comme lu
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </StateView>
      </Card>

      {detail ? (
        <>
          <div
            onClick={() => setDetail(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 60 }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(520px, calc(100vw - 32px))',
              maxHeight: '80vh',
              overflowY: 'auto',
              background: 'var(--color-surface, #fff)',
              border: '1px solid var(--color-border, #e3e3e3)',
              borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,.25)',
              zIndex: 70,
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: 'var(--color-primary, #5b5bd6)',
                  }}
                >
                  Note de service
                </div>
                <h3 style={{ margin: '4px 0 0', fontSize: 17 }}>{detail.titre}</h3>
                {detail.recueLe ? (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted, #666)', marginTop: 2 }}>{detail.recueLe}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Fermer"
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', lineHeight: 1, color: 'var(--color-text-muted, #666)' }}
              >
                ×
              </button>
            </div>
            <p style={{ marginTop: 16, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--color-text, #222)' }}>
              {detail.corps}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
