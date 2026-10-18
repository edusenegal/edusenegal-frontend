import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Card, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { MyClass } from '@/types/domain';

export default function MyClassesPage() {
  const { myClasses } = useServices();
  const list = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });

  const columns: Column<MyClass>[] = [
    { key: 'nom', header: 'Classe', render: (c) => <Link to={`/mes-classes/${c.id}`}>{c.nom}</Link> },
    { key: 'niveau', header: 'Niveau', render: (c) => [c.level, c.series].filter(Boolean).join(' ') },
    { key: 'effectif', header: 'Effectif', render: (c) => String(c.effectif) },
    {
      key: 'role',
      header: 'Rôle',
      render: (c) => (c.estPrincipal ? <Badge tone="info">Professeur principal</Badge> : <Badge tone="neutral">Itinérant</Badge>),
    },
  ];

  return (
    <div>
      <PageHeader title="Mes classes" subtitle="Classes où vous enseignez cette année." />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(c) => c.id} />
        </StateView>
      </Card>
    </div>
  );
}
