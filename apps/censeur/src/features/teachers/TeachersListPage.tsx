import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar/Avatar';
import { Badge, Button, Card, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { StaffStatus, Teacher } from '@/types/domain';

const STATUT_LABEL: Record<StaffStatus, string> = {
  actif: 'Actif',
  suspendu: 'Suspendu',
  transfere: 'Transféré',
  en_attente: 'En attente d’activation',
};
const STATUT_TONE: Record<StaffStatus, 'success' | 'warning' | 'danger'> = {
  actif: 'success',
  suspendu: 'danger',
  transfere: 'warning',
  en_attente: 'warning',
};
import { TeacherFormSheet } from './TeacherFormSheet';

export default function TeachersListPage() {
  const navigate = useNavigate();
  const { teachers, subjects } = useServices();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const list = useQuery({ queryKey: ['teachers'], queryFn: () => teachers.list() });
  const subjectList = useQuery({ queryKey: ['subjects'], queryFn: () => subjects.list() });
  const subjectNameById = new Map((subjectList.data ?? []).map((s) => [s.id, s.nom]));

  const removeMutation = useMutation({
    mutationFn: (id: string) => teachers.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const columns: Column<Teacher>[] = [
    {
      key: 'nom',
      header: 'Enseignant',
      render: (t) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar name={t.nom} size="sm" photoUrl={t.photoUrl} />
          <strong>{t.nom}</strong>
        </div>
      ),
    },
    {
      key: 'matiere',
      header: 'Matière(s)',
      render: (t) => t.subjectIds.map((id) => subjectNameById.get(id) ?? id).join(', ') || '—',
    },
    { key: 'classes', header: 'Classes', render: (t) => t.classes.join(', ') || '—' },
    { key: 'tel', header: 'Téléphone', render: (t) => t.tel },
    {
      key: 'statut',
      header: 'Statut',
      render: (t) => <Badge tone={STATUT_TONE[t.statut]}>{STATUT_LABEL[t.statut]}</Badge>,
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
