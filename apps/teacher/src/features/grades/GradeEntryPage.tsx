import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Field, Input, Select, StateView } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { AssessmentType } from '@/types/domain';

const TYPE_LABEL: Record<AssessmentType, string> = {
  devoir1: 'Devoir 1',
  devoir2: 'Devoir 2',
  composition: 'Composition',
  interro: 'Interrogation',
  tp: 'TP',
  td: 'TD',
  devoir: 'Devoir',
  controle_continu: 'Contrôle continu',
  examen: 'Examen',
  projet: 'Projet',
  expose: 'Exposé',
  stage: 'Stage',
};
const TYPES = Object.keys(TYPE_LABEL) as AssessmentType[];

/** Barème standard des notes — une note ne peut jamais le dépasser. */
const BAREME_STANDARD = 20;

/** Saisie en masse — une note par élève de la classe, même type/coefficient/semestre. */
export default function GradeEntryPage() {
  const { myClasses, subjects, grades } = useServices();

  const classesQuery = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'mine'], queryFn: () => subjects.listMine() });

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semestre, setSemestre] = useState(1);
  const [type, setType] = useState<AssessmentType>('devoir1');
  const [values, setValues] = useState<Record<string, string>>({});
  const [absents, setAbsents] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ saved: number; updated: number; failed: number } | null>(null);

  /** Coefficient récupéré depuis la configuration de la matière pour cette classe — jamais saisi à la main. */
  const selectedSubject = (subjectsQuery.data ?? []).find((s) => s.id === subjectId);
  const coefficientEntry = selectedSubject?.coefficients.find((c) => c.classeId === classId && c.enseignee);
  const coefficient = coefficientEntry?.valeur ?? null;

  const rosterQuery = useQuery({
    queryKey: ['roster', classId],
    queryFn: () => myClasses.roster(classId),
    enabled: classId !== '',
  });

  // Types déjà saisis pour cette classe/matière/semestre — demande
  // explicite : ne pas permettre de ressaisir un type déjà enregistré (qui
  // écraserait silencieusement les notes existantes, voir `enterBulk`).
  const existingGradesQuery = useQuery({
    queryKey: ['grades', classId, subjectId, semestre],
    queryFn: () => grades.listForClass(classId, subjectId, semestre),
    enabled: classId !== '' && subjectId !== '',
  });
  const usedTypes = new Set((existingGradesQuery.data ?? []).map((g) => g.type));
  const availableTypes = TYPES.filter((t) => !usedTypes.has(t));

  // Si le type sélectionné vient d'être pris (changement de classe/matière/
  // semestre révélant qu'il est déjà saisi), on retombe sur le premier type
  // encore disponible plutôt que de laisser une sélection invalide.
  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(type)) {
      setType(availableTypes[0]!);
    }
  }, [classId, subjectId, semestre, existingGradesQuery.data]);

  const entries = useMemo(
    () =>
      (rosterQuery.data ?? []).map((s) => ({
        studentId: s.id,
        valeur: Number(values[s.id] ?? 0),
        absent: absents[s.id] ?? false,
      })),
    [rosterQuery.data, values, absents],
  );

  const saveMutation = useMutation({
    mutationFn: () => grades.enterBulk({ classId, subjectId, semestre, type, session: 1, coefficient: coefficient ?? 0, entries }),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Échec de l’enregistrement.'),
  });

  function onSubmit() {
    if (!classId || !subjectId) {
      setError('Classe et matière sont obligatoires.');
      return;
    }
    if (usedTypes.has(type)) {
      setError(`« ${TYPE_LABEL[type]} » a déjà été saisi pour cette classe/matière/semestre.`);
      return;
    }
    if (coefficient === null) {
      setError("Coefficient introuvable : cette matière n'est pas configurée pour cette classe.");
      return;
    }
    const depasseBareme = entries.some((e) => !e.absent && (e.valeur < 0 || e.valeur > BAREME_STANDARD));
    if (depasseBareme) {
      setError(`Une note ne peut pas dépasser le barème (${BAREME_STANDARD}).`);
      return;
    }
    setResult(null);
    saveMutation.mutate();
  }

  return (
    <div>
      <PageHeader title="Saisie des notes" subtitle="Notes en masse pour une classe, une matière et une évaluation." />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Évaluation" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Classe" required>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 180 }}>
              <option value="">Choisir…</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Matière" required>
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
          <Field
            label="Type"
            hint={
              classId && subjectId && availableTypes.length === 0
                ? 'Tous les types ont déjà été saisis pour cette sélection.'
                : undefined
            }
          >
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as AssessmentType)}
              style={{ width: 170 }}
              disabled={availableTypes.length === 0}
            >
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
              {availableTypes.length === 0 ? <option value={type}>{TYPE_LABEL[type]}</option> : null}
            </Select>
          </Field>
          <Field label="Coefficient">
            <div
              style={{
                width: 90,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                fontWeight: 600,
                color: coefficient === null ? 'var(--color-danger)' : undefined,
              }}
              title="Coefficient défini dans la configuration de la matière pour cette classe."
            >
              {coefficient === null ? (subjectId && classId ? 'Aucun' : '—') : coefficient}
            </div>
          </Field>
        </div>
      </Card>

      {classId ? (
        <Card>
          <CardHeader
            title="Notes des élèves"
            action={
              <Button
                variant="primary"
                size="sm"
                loading={saveMutation.isPending}
                disabled={availableTypes.length === 0}
                onClick={onSubmit}
              >
                Enregistrer
              </Button>
            }
          />
          {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: '0 0 8px' }}>{error}</p> : null}
          {result ? (
            <p style={{ color: 'var(--color-success)', fontSize: 13, margin: '0 0 8px' }}>
              {result.saved} enregistrée(s), {result.updated} mise(s) à jour{result.failed ? `, ${result.failed} échec(s)` : ''}.
            </p>
          ) : null}
          <StateView loading={rosterQuery.isLoading} error={rosterQuery.error} empty={rosterQuery.data?.length === 0}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(rosterQuery.data ?? []).map((s) => (
                <div
                  key={s.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--color-border)' }}
                >
                  <span>
                    {s.prenom} {s.nom}
                  </span>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <label style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={absents[s.id] ?? false}
                        onChange={(e) => setAbsents((prev) => ({ ...prev, [s.id]: e.target.checked }))}
                      />
                      Absent
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={BAREME_STANDARD}
                      step={0.25}
                      disabled={absents[s.id]}
                      value={values[s.id] ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const n = Number(raw);
                        const clamped = raw !== '' && !Number.isNaN(n) && n > BAREME_STANDARD ? String(BAREME_STANDARD) : raw;
                        setValues((prev) => ({ ...prev, [s.id]: clamped }));
                      }}
                      style={{ width: 80 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </StateView>
        </Card>
      ) : null}
    </div>
  );
}
