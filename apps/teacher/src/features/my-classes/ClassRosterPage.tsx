import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { StudentRosterEntry } from '@/types/domain';

export default function ClassRosterPage() {
  const { classId = '' } = useParams();
  const { myClasses } = useServices();

  const classesQuery = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });
  const rosterQuery = useQuery({ queryKey: ['roster', classId], queryFn: () => myClasses.roster(classId) });

  const classe = classesQuery.data?.find((c) => c.id === classId);

  const columns: Column<StudentRosterEntry>[] = [
    { key: 'nom', header: 'Nom', render: (s) => `${s.prenom} ${s.nom}` },
  ];

  return (
    <div>
      <PageHeader
        title={classe ? `Classe — ${classe.nom}` : 'Classe'}
        subtitle="Liste des élèves inscrits. Accès rapide aux notes, à l’appel et aux examens de cette classe."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/notes/classe">Notes</Link>
            <Link to="/appel">Appel</Link>
            <Link to="/examens">Examens</Link>
          </div>
        }
      />
      <Card>
        <StateView loading={rosterQuery.isLoading} error={rosterQuery.error} empty={rosterQuery.data?.length === 0}>
          <Table columns={columns} rows={rosterQuery.data ?? []} rowKey={(s) => s.id} />
        </StateView>
      </Card>
    </div>
  );
}
