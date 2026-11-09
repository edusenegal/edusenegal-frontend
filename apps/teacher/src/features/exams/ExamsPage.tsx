import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Field, Input, Select, StateView, Table, type Column, useConfirm } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { ExamEvent, ExamType } from '@/types/domain';

const TYPE_LABEL: Record<ExamType, string> = {
  devoir1: 'Devoir 1',
  devoir2: 'Devoir 2',
  composition: 'Composition',
  interro: 'Interrogation',
  examen_blanc: 'Examen blanc',
  conseil_de_classe: 'Conseil de classe',
};
const TYPES = Object.keys(TYPE_LABEL) as ExamType[];

export default function ExamsPage() {
  const { myClasses, subjects, exams, rooms } = useServices();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const classesQuery = useQuery({ queryKey: ['my-classes'], queryFn: () => myClasses.list() });
  const subjectsQuery = useQuery({ queryKey: ['subjects', 'mine'], queryFn: () => subjects.listMine() });

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [titre, setTitre] = useState('');
  const [type, setType] = useState<ExamType>('devoir1');
  const [semestre, setSemestre] = useState(1);
  const [date, setDate] = useState('');
  const [heureDebut, setHeureDebut] = useState('08:00');
  const [heureFin, setHeureFin] = useState('10:00');
  const [salle, setSalle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: () => rooms.list() });
  // Disponibilité recalculée à chaque changement de date/heure, pour marquer
  // dans la liste les salles déjà occupées par un autre examen ce jour-là.
  const availabilityQuery = useQuery({
    queryKey: ['room-availability', date, heureDebut, heureFin],
    queryFn: () => rooms.checkAvailability({ date, heureDebut, heureFin }),
    enabled: date !== '' && heureFin > heureDebut,
  });
  const availabilityByName = new Map(
    (availabilityQuery.data ?? []).map((a) => [a.salleNom.toLowerCase(), a]),
  );

  const examsQuery = useQuery({
    queryKey: ['exams', classId],
    queryFn: () => exams.listForClass(classId),
    enabled: classId !== '',
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['exams', classId] });
  }

  const scheduleMutation = useMutation({
    mutationFn: () => exams.schedule({ classId, subjectId, titre: titre.trim(), type, semestre, date, heureDebut, heureFin, salle: salle.trim() || undefined }),
    onSuccess: () => {
      invalidate();
      setTitre('');
      setDate('');
      setSalle('');
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Échec de la planification.'),
  });

  const removeMutation = useMutation({
    mutationFn: (examId: string) => exams.remove(examId),
    onSuccess: invalidate,
  });

  function onSubmit() {
    if (!classId || !subjectId || !titre.trim() || !date) {
      setError('Classe, matière, titre et date sont obligatoires.');
      return;
    }
    scheduleMutation.mutate();
  }

  const columns: Column<ExamEvent>[] = [
    { key: 'titre', header: 'Titre', render: (e) => e.titre },
    { key: 'type', header: 'Type', render: (e) => TYPE_LABEL[e.type] },
    { key: 'date', header: 'Date', render: (e) => `${e.date} (${e.heureDebut}–${e.heureFin})` },
    { key: 'salle', header: 'Salle', render: (e) => e.salle ?? '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (e) => (
        <Button variant="ghost" size="sm" onClick={() => { void confirm({ title: 'Supprimer', message: 'Supprimer définitivement cette évaluation ?', danger: true }).then((ok) => { if (ok) removeMutation.mutate(e.id); }); }}>
          Supprimer
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Devoirs & examens" subtitle="Calendrier des évaluations planifiées pour vos classes." />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Planifier une évaluation" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Classe" required>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: 170 }}>
              <option value="">Choisir…</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Matière" required>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: 170 }}>
              <option value="">Choisir…</option>
              {(subjectsQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Titre" required>
            <Input value={titre} onChange={(e) => setTitre(e.target.value)} style={{ width: 200 }} />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as ExamType)} style={{ width: 160 }}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Semestre">
            <Select value={String(semestre)} onChange={(e) => setSemestre(Number(e.target.value))} style={{ width: 110 }}>
              {[1, 2, 3, 4].map((s) => (
                <option key={s} value={s}>
                  Sem. {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Début">
            <Input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
          </Field>
          <Field label="Fin">
            <Input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
          </Field>
          <Field
            label="Salle"
            hint={
              salle && availabilityByName.get(salle.toLowerCase())?.disponible === false
                ? 'Cette salle est déjà occupée à ce créneau.'
                : undefined
            }
          >
            <Select value={salle} onChange={(e) => setSalle(e.target.value)} style={{ width: 160 }}>
              <option value="">— Aucune —</option>
              {(roomsQuery.data ?? []).map((r) => {
                const avail = availabilityByName.get(r.nom.toLowerCase());
                const unavailable = avail ? !avail.disponible : false;
                return (
                  <option key={r.id} value={r.nom} disabled={unavailable}>
                    {r.nom}
                    {unavailable ? ' — occupée' : ''}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Button variant="primary" size="sm" loading={scheduleMutation.isPending} onClick={onSubmit}>
            Planifier
          </Button>
        </div>
        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{error}</p> : null}
      </Card>

      {classId ? (
        <Card>
          <StateView loading={examsQuery.isLoading} error={examsQuery.error} empty={examsQuery.data?.length === 0}>
            <Table columns={columns} rows={examsQuery.data ?? []} rowKey={(e) => e.id} />
          </StateView>
        </Card>
      ) : null}
    </div>
  );
}
