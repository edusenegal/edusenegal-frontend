import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { isoToFR } from '@/utils/format';
import type { Reservation } from '@/types/domain';

export default function ReservationsPage() {
  const { library } = useServices();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['reservations'], queryFn: () => library.listReservations() });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => library.cancelReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['library-stats'] });
    },
  });

  const columns: Column<Reservation>[] = [
    { key: 'oeuvre', header: 'Œuvre', render: (r) => r.workTitre },
    { key: 'emprunteur', header: 'Demandeur', render: (r) => r.emprunteurNom },
    { key: 'date', header: 'Réservé le', render: (r) => isoToFR(r.dateReservation) },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => cancelMutation.mutate(r.id)}>
            Annuler
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Réservations" subtitle="Demandes de réservation en attente d’un exemplaire." />
      <StateView
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        empty={query.data?.length === 0}
        emptyLabel="Aucune réservation active."
      >
        <Table columns={columns} rows={query.data ?? []} rowKey={(r) => r.id} />
      </StateView>
    </div>
  );
}
