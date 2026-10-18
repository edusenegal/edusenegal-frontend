import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, Field, Select, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { Grade } from '@/types/domain';

export default function ClassGradesPage() {
  const { myClasses, subjects, grades } = useServices();

  const classesQuery = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'mine'], queryFn: () => subjects.listMine() });

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semestre, setSemestre] = useState(1);

  const rosterQuery = useQuery({
    queryKey: ['roster', classId],
    queryFn: () => myClasses.roster(classId),
    enabled: classId !== '',
  });
  const gradesQuery = useQuery({
    queryKey: ['grades', classId, subjectId, semestre],
    queryFn: () => grades.listForClass(classId, subjectId, semestre),
    enabled: classId !== '' && subjectId !== '',
  });

  const nameById = new Map((rosterQuery.data ?? []).map((s) => [s.id, `${s.prenom} ${s.nom}`]));

  const columns: Column<Grade>[] = [
    { key: 'eleve', header: 'Élève', render: (g) => nameById.get(g.studentId) ?? g.studentId },
    { key: 'type', header: 'Évaluation', render: (g) => g.type },
    { key: 'valeur', header: 'Note', render: (g) => `${g.valeur}/20` },
    { key: 'coefficient', header: 'Coef.', render: (g) => String(g.coefficient) },
    { key: 'commentaire', header: 'Commentaire', render: (g) => g.commentaire ?? '—' },
  ];

  return (
    <div>
      <PageHeader title="Notes d’une classe" subtitle="Consultez les notes déjà saisies pour une matière et un semestre." />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Filtre" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Classe">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 180 }}>
              <option value="">Choisir…</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Matière">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: 180 }}>
              <option value="">Choisir…</option>
              {(subjectsQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Semestre">
            <Select value={String(semestre)} onChange={(e) => setSemestre(Number(e.target.value))} style={{ width: 120 }}>
              {[1, 2, 3, 4].map((s) => (
                <option key={s} value={s}>
                  Semestre {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <StateView loading={gradesQuery.isLoading} error={gradesQuery.error} empty={classId !== '' && subjectId !== '' && gradesQuery.data?.length === 0}>
          <Table columns={columns} rows={gradesQuery.data ?? []} rowKey={(g) => g.id} />
        </StateView>
      </Card>
    </div>
  );
}
