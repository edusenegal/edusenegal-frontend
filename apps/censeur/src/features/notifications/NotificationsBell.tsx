import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/api/notifications.api';

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Cloche de notifications : compteur de non-lus + liste déroulante. Ouvrir une
 * note de service (`entityType === 'service-note'`) affiche un popup avec le
 * détail complet (titre, date, corps intégral). Cliquer une notification la
 * marque comme lue.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<NotificationItem | null>(null);
  const queryClient = useQueryClient();

  const unread = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: getMyNotifications,
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
  };
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });

  const count = unread.data ?? 0;
  const items = list.data ?? [];

  function openItem(n: NotificationItem) {
    if (!n.read) readOne.mutate(n.id);
    if (n.entityType === 'service-note' || n.type === 'SERVICE_NOTE') {
      setDetail(n);
      setOpen(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        style={{ position: 'relative', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}
      >
        🔔
        {count > 0 ? (
          <span
            style={{
              position: 'absolute', top: -2, right: -2,
              background: 'var(--color-danger, #e5484d)', color: '#fff', borderRadius: 10,
              fontSize: 11, minWidth: 16, height: 16, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', padding: '0 4px',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, maxHeight: 440,
              overflowY: 'auto', background: 'var(--color-surface, #fff)',
              border: '1px solid var(--color-border, #e3e3e3)', borderRadius: 10,
              boxShadow: '0 10px 34px rgba(0,0,0,.14)', zIndex: 50,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--color-border, #e3e3e3)' }}>
              <strong style={{ fontSize: 14 }}>Notifications</strong>
              <button
                type="button"
                onClick={() => readAll.mutate()}
                disabled={readAll.isPending || count === 0}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary, #5b5bd6)', cursor: count === 0 ? 'default' : 'pointer', fontSize: 12.5, opacity: count === 0 ? 0.5 : 1 }}
              >
                Tout marquer lu
              </button>
            </div>
            {list.isLoading ? (
              <p style={{ padding: 12, fontSize: 13, color: 'var(--color-text-muted, #666)' }}>Chargement…</p>
            ) : items.length === 0 ? (
              <p style={{ padding: 12, fontSize: 13, color: 'var(--color-text-muted, #666)' }}>Aucune notification.</p>
            ) : (
              items.map((n) => {
                const isNote = n.entityType === 'service-note' || n.type === 'SERVICE_NOTE';
                return (
                  <div
                    key={n.id}
                    role={isNote ? 'button' : undefined}
                    onClick={() => openItem(n)}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--color-border, #eee)',
                      background: n.read ? 'transparent' : 'var(--color-primary-soft, #f3f3fb)',
                      cursor: isNote ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                    <div
                      style={{
                        fontSize: 12.5, color: 'var(--color-text-muted, #555)', marginTop: 2,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}
                    >
                      {n.body}
                    </div>
                    {isNote ? (
                      <div style={{ fontSize: 11.5, color: 'var(--color-primary, #5b5bd6)', marginTop: 4 }}>Voir le détail →</div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : null}

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
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 'min(520px, calc(100vw - 32px))', maxHeight: '80vh', overflowY: 'auto',
              background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e3e3e3)',
              borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.25)', zIndex: 70, padding: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--color-primary, #5b5bd6)' }}>
                  Note de service
                </div>
                <h3 style={{ margin: '4px 0 0', fontSize: 17 }}>{detail.title}</h3>
                {detail.createdAt ? (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted, #666)', marginTop: 2 }}>{formatWhen(detail.createdAt)}</div>
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
              {detail.body}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
