import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { Teacher } from '@/types/domain';
import { TeacherFormSheet } from './TeacherFormSheet';

export default function TeachersListPage() {
  const navigate = useNavigate();
  const { teachers } = useServices();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const list = useQuery({ queryKey: ['teachers'], queryFn: () => teachers.list() });

  const removeMutation = useMutation({
    mutationFn: (id: string) => teachers.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const columns: Column<Teacher>[] = [
    { key: 'nom', header: 'Enseignant', render: (t) => <strong>{t.nom}</strong> },
    { key: 'matiere', header: 'Matière', render: (t) => t.matiere },
    { key: 'classes', header: 'Classes', render: (t) => t.classes.join(', ') || '—' },
    { key: 'tel', header: 'Téléphone', render: (t) => t.tel },
    {
      key: 'statut',
      header: 'Statut',
      render: (t) => <Badge tone={t.statut === 'actif' ? 'success' : 'warning'}>{t.statut === 'actif' ? 'Actif' : 'En congé'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Retirer ${t.nom} de l’établissement ?`)) removeMutation.mutate(t.id);
          }}
        >
          Retirer
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Enseignants"
        subtitle={`${list.data?.length ?? 0} enseignants rattachés à l’établissement.`}
        action={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            + Ajouter un enseignant
          </Button>
        }
      />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(t) => t.id} onRowClick={(t) => navigate(`/enseignants/${t.id}`)} />
        </StateView>
      </Card>
      <TeacherFormSheet open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
