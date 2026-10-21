import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Field, Select, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import styles from './PromotionsPage.module.css';

export default function PromotionsPage() {
  const { classes, students, promotions } = useServices();
  const queryClient = useQueryClient();

  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const studentList = useQuery({ queryKey: ['students'], queryFn: () => students.list() });

  const [fromClassId, setFromClassId] = useState('');
  const [toClassId, setToClassId] = useState('');
  const [classError, setClassError] = useState<string | null>(null);
  const [classSuccess, setClassSuccess] = useState<string | null>(null);

  const [studentId, setStudentId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [studentSuccess, setStudentSuccess] = useState<string | null>(null);

  const sortedClasses = [...(classList.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const sortedStudents = [...(studentList.data ?? [])].sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`));

  const effectiveFromClassId = fromClassId || sortedClasses[0]?.id || '';

  const promoteClassMutation = useMutation({
    mutationFn: () => promotions.promoteClass(effectiveFromClassId, toClassId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setClassSuccess(`${result.moved} élève(s) promu(s) avec succès.`);
    },
  });

  const promoteStudentMutation = useMutation({
    mutationFn: () => promotions.promoteStudent(studentId, targetClassId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setStudentSuccess('Élève promu avec succès.');
    },
  });

  function onPromoteClass() {
    setClassError(null);
    setClassSuccess(null);
    if (!toClassId) {
      setClassError('Choisissez la classe supérieure.');
      return;
    }
    if (effectiveFromClassId === toClassId) {
      setClassError('La classe de départ et la classe d’arrivée doivent être différentes.');
      return;
    }
    promoteClassMutation.mutate();
  }

  return (
    <div>
      <PageHeader title="Promotions" subtitle="Faire passer un élève, ou toute une classe, au niveau supérieur." />
      <div className={styles.grid}>
        <Card padded>
          <CardHeader title="Promotion par classe" />
          <p className={styles.hint}>Fait passer tous les élèves d’une classe vers une autre classe.</p>
          <StateView loading={classList.isLoading} error={classList.error}>
            <Field label="Classe de départ">
              <Select id="p-from" value={fromClassId || sortedClasses[0]?.id || ''} onChange={(e) => setFromClassId(e.target.value)}>
                {sortedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.effectif} élèves)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Classe d’arrivée" required>
              <Select id="p-to" value={toClassId} onChange={(e) => setToClassId(e.target.value)}>
                <option value="">— Choisir la classe supérieure —</option>
                {sortedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            {classError ? <p className={styles.error}>{classError}</p> : null}
            {classSuccess ? <p className={styles.success}>{classSuccess}</p> : null}
            <Button id="p-bulk" variant="primary" loading={promoteClassMutation.isPending} onClick={onPromoteClass}>
              Promouvoir la classe
            </Button>
          </StateView>
        </Card>

        <Card padded>
          <CardHeader title="Promotion individuelle" />
          <p className={styles.hint}>Fait passer un seul élève vers la classe de votre choix.</p>
          <StateView loading={studentList.isLoading} error={studentList.error}>
            <Field label="Élève">
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">— Choisir un élève —</option>
                {sortedStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.prenom} {s.nom} — {s.classe}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nouvelle classe" required>
              <Select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
                <option value="">— Choisir une classe —</option>
                {sortedClasses
                  .filter((c) => c.id !== studentList.data?.find((s) => s.id === studentId)?.classeId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Field>
            {studentSuccess ? <p className={styles.success}>{studentSuccess}</p> : null}
            <Button
              variant="primary"
              disabled={!studentId || !targetClassId}
              loading={promoteStudentMutation.isPending}
              onClick={() => promoteStudentMutation.mutate()}
            >
              Promouvoir l’élève
            </Button>
          </StateView>
        </Card>
      </div>
    </div>
  );
}
