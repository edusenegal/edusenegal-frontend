import { useMemo, useState } from 'react';
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

  // Promotion individuelle : classe de départ → sélection d'un ou plusieurs
  // élèves de cette classe → classe de destination.
  const [indivFromClassId, setIndivFromClassId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [indivTargetClassId, setIndivTargetClassId] = useState('');
  const [indivError, setIndivError] = useState<string | null>(null);
  const [indivSuccess, setIndivSuccess] = useState<string | null>(null);

  const sortedClasses = [...(classList.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const effectiveFromClassId = fromClassId || sortedClasses[0]?.id || '';

  const studentsOfIndivClass = useMemo(
    () =>
      [...(studentList.data ?? [])]
        .filter((s) => s.classeId === indivFromClassId)
        .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr')),
    [studentList.data, indivFromClassId],
  );

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const promoteClassMutation = useMutation({
    mutationFn: () => promotions.promoteClass(effectiveFromClassId, toClassId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setClassSuccess(`${result.moved} élève(s) promu(s) avec succès.`);
    },
  });

  const promoteSelectedMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedStudentIds);
      // Déplacement séquentiel : chaque élève est désinscrit de sa classe puis
      // inscrit dans la destination (promoteStudent). On compte les succès pour
      // un retour fiable même si un élève échoue (ex. destination pleine).
      let moved = 0;
      for (const id of ids) {
        await promotions.promoteStudent(id, indivTargetClassId);
        moved += 1;
      }
      return moved;
    },
    onSuccess: (moved) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSelectedStudentIds(new Set());
      setIndivSuccess(`${moved} élève(s) déplacé(s) avec succès.`);
    },
    onError: (err) => setIndivError(err instanceof Error ? err.message : 'Le déplacement a échoué.'),
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

  function onPromoteSelected() {
    setIndivError(null);
    setIndivSuccess(null);
    if (!indivFromClassId) {
      setIndivError('Choisissez la classe de départ.');
      return;
    }
    if (selectedStudentIds.size === 0) {
      setIndivError('Sélectionnez au moins un élève.');
      return;
    }
    if (!indivTargetClassId) {
      setIndivError('Choisissez la classe de destination.');
      return;
    }
    if (indivTargetClassId === indivFromClassId) {
      setIndivError('La classe de destination doit être différente de la classe de départ.');
      return;
    }
    promoteSelectedMutation.mutate();
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
          <p className={styles.hint}>
            Choisissez la classe de départ, cochez un ou plusieurs élèves, puis la classe de destination.
          </p>
          <StateView loading={classList.isLoading || studentList.isLoading} error={classList.error ?? studentList.error}>
            <Field label="Classe de départ" required>
              <Select
                value={indivFromClassId}
                onChange={(e) => {
                  setIndivFromClassId(e.target.value);
                  setSelectedStudentIds(new Set());
                  setIndivError(null);
                  setIndivSuccess(null);
                }}
              >
                <option value="">— Choisir une classe —</option>
                {sortedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.effectif} élèves)
                  </option>
                ))}
              </Select>
            </Field>

            {indivFromClassId ? (
              <Field label={`Élèves à déplacer (${selectedStudentIds.size} sélectionné${selectedStudentIds.size > 1 ? 's' : ''})`} required>
                <div
                  style={{
                    maxHeight: 240,
                    overflowY: 'auto',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {studentsOfIndivClass.length === 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Aucun élève dans cette classe.</span>
                  ) : (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, paddingBottom: 4, borderBottom: '1px solid var(--color-border)' }}>
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.size === studentsOfIndivClass.length}
                          onChange={(e) =>
                            setSelectedStudentIds(
                              e.target.checked ? new Set(studentsOfIndivClass.map((s) => s.id)) : new Set(),
                            )
                          }
                        />
                        Tout sélectionner
                      </label>
                      {studentsOfIndivClass.map((s) => (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer' }}>
                          <input type="checkbox" checked={selectedStudentIds.has(s.id)} onChange={() => toggleStudent(s.id)} />
                          <span>
                            {s.prenom} {s.nom}
                          </span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              </Field>
            ) : null}

            <Field label="Classe de destination" required>
              <Select value={indivTargetClassId} onChange={(e) => setIndivTargetClassId(e.target.value)}>
                <option value="">— Choisir une classe —</option>
                {sortedClasses
                  .filter((c) => c.id !== indivFromClassId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Field>

            {indivError ? <p className={styles.error}>{indivError}</p> : null}
            {indivSuccess ? <p className={styles.success}>{indivSuccess}</p> : null}
            <Button
              variant="primary"
              disabled={selectedStudentIds.size === 0 || !indivTargetClassId}
              loading={promoteSelectedMutation.isPending}
              onClick={onPromoteSelected}
            >
              Déplacer les élèves sélectionnés
            </Button>
          </StateView>
        </Card>
      </div>
    </div>
  );
}
