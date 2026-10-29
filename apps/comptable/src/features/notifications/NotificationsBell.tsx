import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyNotifications, getUnreadCount, markAllNotificationsRead } from '@/api/notifications.api';

/** Cloche de notifications : compteur de non-lus + liste déroulante. */
/** entityType (métadonnées backend) → route de cette app. */
const ROUTE_BY_ENTITY: Record<string, string> = {
  expense: '/depenses',
  payment: '/encaissements',
};

export function NotificationsBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });

  const count = unread.data ?? 0;
  const items = list.data ?? [];

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
                const route = n.entityType ? ROUTE_BY_ENTITY[n.entityType] : undefined;
                return (
                  <div
                    key={n.id}
                    role={route ? 'button' : undefined}
                    onClick={route ? () => { setOpen(false); navigate(route); } : undefined}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--color-border, #eee)',
                      background: n.read ? 'transparent' : 'var(--color-primary-soft, #f3f3fb)',
                      cursor: route ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-muted, #555)', marginTop: 2 }}>{n.body}</div>
                    {route ? <div style={{ fontSize: 11.5, color: 'var(--color-primary, #5b5bd6)', marginTop: 4 }}>Voir →</div> : null}
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
