import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Meter, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { ClassGroup, Teacher } from '@/types/domain';
import { ClassFormSheet } from './ClassFormSheet';

export default function ClassesListPage() {
  const navigate = useNavigate();
  const { classes, teachers } = useServices();
  const [formOpen, setFormOpen] = useState(false);

  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const teacherList = useQuery({ queryKey: ['teachers'], queryFn: () => teachers.list() });

  const teacherById = new Map((teacherList.data ?? []).map((t: Teacher) => [t.id, t]));

  const columns: Column<ClassGroup>[] = [
    { key: 'name', header: 'Classe', render: (c) => <strong>{c.name}</strong> },
    {
      key: 'prof',
      header: 'Professeur principal',
      render: (c) => (c.homeroomTeacherId ? teacherById.get(c.homeroomTeacherId)?.nom ?? '—' : '—'),
    },
    {
      key: 'effectif',
      header: 'Effectif',
      render: (c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
          <span style={{ whiteSpace: 'nowrap' }}>
            {c.effectif}/{c.capacite}
          </span>
          <Meter value={(c.effectif / c.capacite) * 100} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Classes"
        subtitle={`${classList.data?.length ?? 0} classes pour l’année en cours.`}
        action={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            + Ajouter une classe
          </Button>
        }
      />
      <Card>
        <StateView loading={classList.isLoading} error={classList.error} empty={classList.data?.length === 0}>
          <Table
            columns={columns}
            rows={classList.data ?? []}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/classes/${c.id}`)}
          />
        </StateView>
      </Card>
      <ClassFormSheet open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
