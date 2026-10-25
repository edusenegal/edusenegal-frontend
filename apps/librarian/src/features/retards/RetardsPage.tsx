import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { isoToFR, todayISO } from '@/utils/format';
import { BORROWER_TYPE_LABEL, type Loan } from '@/types/domain';

function daysLate(dateRetourPrevue: string): number {
  const prevu = new Date(`${dateRetourPrevue}T00:00:00`).getTime();
  const now = new Date(`${todayISO()}T00:00:00`).getTime();
  return Math.max(0, Math.round((now - prevu) / 86_400_000));
}

export default function RetardsPage() {
  const { library } = useServices();
  const queryClient = useQueryClient();
  const loansQuery = useQuery({ queryKey: ['loans', 'retard'], queryFn: () => library.listLoans('retard') });

  const reminderMutation = useMutation({
    mutationFn: (id: string) => library.sendReminder(id),
  });
  const returnMutation = useMutation({
    mutationFn: (id: string) => library.returnLoan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['library-stats'] });
    },
  });

  const columns: Column<Loan>[] = [
    { key: 'oeuvre', header: 'Œuvre', render: (l) => l.workTitre },
    { key: 'emprunteur', header: 'Emprunteur', render: (l) => `${l.emprunteurNom} (${BORROWER_TYPE_LABEL[l.emprunteurType]})` },
    { key: 'prevu', header: 'Retour prévu', render: (l) => isoToFR(l.dateRetourPrevue) },
    {
      key: 'retard',
      header: 'Retard',
      align: 'right',
      render: (l) => <Badge tone="danger">{daysLate(l.dateRetourPrevue)} j</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (l) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => reminderMutation.mutate(l.id)} loading={reminderMutation.isPending}>
            Envoyer un rappel
          </Button>
          <Button variant="ghost" size="sm" onClick={() => returnMutation.mutate(l.id)}>
            Retour
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Retards" subtitle="Emprunts dont la date de retour est dépassée." />
      <StateView
        loading={loansQuery.isLoading}
        error={loansQuery.error}
        onRetry={() => loansQuery.refetch()}
        empty={loansQuery.data?.length === 0}
        emptyLabel="Aucun retard. 🎉"
      >
        <Table columns={columns} rows={loansQuery.data ?? []} rowKey={(l) => l.id} />
      </StateView>
    </div>
  );
}
