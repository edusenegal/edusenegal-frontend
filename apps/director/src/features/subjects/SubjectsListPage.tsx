import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { Subject } from '@/types/domain';
import { SubjectFormSheet } from './SubjectFormSheet';

export default function SubjectsListPage() {
  const navigate = useNavigate();
  const { subjects } = useServices();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const list = useQuery({ queryKey: ['subjects'], queryFn: () => subjects.list() });

  const removeMutation = useMutation({
    mutationFn: (id: string) => subjects.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const columns: Column<Subject>[] = [
    { key: 'code', header: 'Code', render: (s) => <strong>{s.code}</strong> },
    { key: 'nom', header: 'Matière', render: (s) => s.nom },
    {
      key: 'classes',
      header: 'Classes enseignées',
      render: (s) => `${s.coefficients.filter((c) => c.enseignee).length}/${s.coefficients.length}`,
    },
    {
      key: 'optionnelle',
      header: 'Optionnelle',
      render: (s) => (s.optionnelle ? <Badge tone="warning">Optionnelle</Badge> : '—'),
    },
    {
      key: 'origine',
      header: 'Catalogue',
      render: (s) => <Badge tone={s.global ? 'info' : 'neutral'}>{s.global ? 'Global' : 'Établissement'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) =>
        s.global ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Supprimer la matière « ${s.nom} » de l’établissement ?`)) removeMutation.mutate(s.id);
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
        title="Matières"
        subtitle={`${list.data?.length ?? 0} matières — catalogue global et matières propres à l’établissement.`}
        action={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            + Ajouter une matière
          </Button>
        }
      />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(s) => s.id} onRowClick={(s) => navigate(`/matieres/${s.id}`)} />
        </StateView>
      </Card>
      <SubjectFormSheet open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
