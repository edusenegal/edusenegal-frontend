import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, Field, Select } from '@/components/ui';
import { CourseDocumentsSection } from '@/components/documents/CourseDocumentsSection';
import { useServices } from '@/hooks/useServices';

export default function CourseDocumentsPage() {
  const { subjects } = useServices();
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'mine'], queryFn: () => subjects.listMine() });
  const [subjectId, setSubjectId] = useState('');

  return (
    <div>
      <PageHeader title="Cours & ressources" subtitle="Déposez vos cours, exercices, corrigés et sujets d’examen par matière." />

      <Card padded style={{ marginBottom: 16 }}>
        <Field label="Matière">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: 220 }}>
            <option value="">Choisir…</option>
            {(subjectsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {subjectId ? (
        <Card padded>
          <CourseDocumentsSection subjectId={subjectId} />
        </Card>
      ) : null}
    </div>
  );
}
