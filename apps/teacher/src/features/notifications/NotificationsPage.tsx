import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';

export default function NotificationsPage() {
  const { notifications } = useServices();
  const queryClient = useQueryClient();
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
            {(list.data ?? []).map((n) => (
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
                <div>
                  <div style={{ fontWeight: n.lue ? 400 : 700 }}>{n.titre}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{n.corps}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}>{n.recueLe}</div>
                </div>
                {n.lue ? (
                  <Badge tone="neutral">Lu</Badge>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate(n.id)}>
                    Marquer comme lu
                  </Button>
                )}
              </div>
            ))}
          </div>
        </StateView>
      </Card>
    </div>
  );
}
