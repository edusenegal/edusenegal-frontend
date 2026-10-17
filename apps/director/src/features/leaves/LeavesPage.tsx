import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { LeaveRequest } from '@/types/domain';

const STATUS_TONE = { en_attente: 'warning', approuve: 'success', rejete: 'danger' } as const;
const STATUS_LABEL = { en_attente: 'En attente', approuve: 'Approuvé', rejete: 'Rejeté' } as const;

export default function LeavesPage() {
  const { leaves } = useServices();
  const queryClient = useQueryClient();

  const list = useQuery({ queryKey: ['leaves'], queryFn: () => leaves.list() });

  const reviewMutation = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => leaves.review(id, approve),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaves'] }),
  });

  const columns: Column<LeaveRequest>[] = [
    { key: 'enseignant', header: 'Enseignant', render: (l) => l.teacherNom },
    { key: 'periode', header: 'Période', render: (l) => `${l.dateDebut} → ${l.dateFin}` },
    { key: 'motif', header: 'Motif', render: (l) => l.motif },
    { key: 'remplacant', header: 'Remplaçant', render: (l) => l.remplacant ?? '—' },
    {
      key: 'piece',
      header: 'Pièce jointe',
      render: (l) =>
        l.pieceJointe ? (
          <span title={l.pieceJointe.nom} style={{ fontSize: 12.5 }}>
            📎 {l.pieceJointe.nom}
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-faint)' }}>Aucune</span>
        ),
    },
    { key: 'statut', header: 'Statut', render: (l) => <Badge tone={STATUS_TONE[l.statut]}>{STATUS_LABEL[l.statut]}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (l) =>
        l.statut === 'en_attente' ? (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" loading={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: l.id, approve: true })}>
              Approuver
            </Button>
            <Button variant="ghost" size="sm" onClick={() => reviewMutation.mutate({ id: l.id, approve: false })}>
              Rejeter
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Congés & absences" subtitle="Demandes de congé du personnel, avec les pièces jointes transmises." />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(l) => l.id} />
        </StateView>
      </Card>
    </div>
  );
}
