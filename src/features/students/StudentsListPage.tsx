import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Input, Select, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { StudentsTable } from './StudentsTable';
import { StudentFormSheet } from './StudentFormSheet';

export default function StudentsListPage() {
  const navigate = useNavigate();
  const { students, classes } = useServices();
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const studentList = useQuery({
    queryKey: ['students', classFilter || undefined],
    queryFn: () => students.list(classFilter || undefined),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return studentList.data ?? [];
    return (studentList.data ?? []).filter((s) => `${s.prenom} ${s.nom}`.toLowerCase().includes(q));
  }, [studentList.data, search]);

  return (
    <div>
      <PageHeader
        title="Élèves"
        subtitle={`${filtered.length} élèves${classFilter ? ' dans cette classe' : ' sur l’ensemble de l’établissement'}.`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un élève…"
              style={{ maxWidth: 220 }}
            />
            <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">Toutes les classes</option>
              {classList.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              + Ajouter un élève
            </Button>
          </div>
        }
      />
      <Card>
        <StateView loading={studentList.isLoading} error={studentList.error} empty={filtered.length === 0}>
          <StudentsTable students={filtered} showClass={!classFilter} onRowClick={(s) => navigate(`/eleves/${s.id}`)} />
        </StateView>
      </Card>
      <StudentFormSheet open={formOpen} onClose={() => setFormOpen(false)} defaultClassId={classFilter || undefined} />
    </div>
  );
}
