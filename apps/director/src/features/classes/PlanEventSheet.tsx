import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, DateInput, Field, Input, Select, Sheet, Textarea } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { isoToFR, todayISO } from '@/utils/format';
import type { ClassEvent, EventType } from '@/types/domain';

const EVENT_TYPES: EventType[] = ['Devoir', 'Examen', 'Composition', 'Conseil de classe'];

interface PlanEventSheetProps {
  classId: string;
  open: boolean;
  onClose(): void;
}

/** « Planifier » un devoir/examen/composition/conseil de classe pour une classe. */
export function PlanEventSheet({ classId, open, onClose }: PlanEventSheetProps) {
  const { classes, teachers, subjects, rooms } = useServices();
  const queryClient = useQueryClient();

  // Chargés seulement à l'ouverture — pas besoin de les garder à jour en arrière-plan.
  const teacherList = useQuery({ queryKey: ['teachers'], queryFn: () => teachers.list(), enabled: open });
  const subjectList = useQuery({ queryKey: ['subjects'], queryFn: () => subjects.list(), enabled: open });
  const classQuery = useQuery({ queryKey: ['class', classId], queryFn: () => classes.get(classId), enabled: open });
  const roomList = useQuery({ queryKey: ['rooms'], queryFn: () => rooms.list(), enabled: open });

  // Matières ENSEIGNÉES DANS CETTE CLASSE uniquement (voir le même filtre sur `ClassDetailPage`).
  const classSubjects = (subjectList.data ?? []).filter((s) =>
    s.coefficients.some((co) => co.classeId === classId && co.enseignee),
  );
  // Professeurs rattachés à cette classe (principal + itinérants).
  const classTeachers = (teacherList.data ?? []).filter((t) => t.classes.includes(classQuery.data?.name ?? ''));

  const [type, setType] = useState<EventType>('Devoir');
  const [titre, setTitre] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [semestre, setSemestre] = useState<1 | 2>(1);
  const [date, setDate] = useState(todayISO());
  const [heureDebut, setHeureDebut] = useState('08:00');
  const [heureFin, setHeureFin] = useState('09:00');
  const [salle, setSalle] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Salles (task #217) : disponibilité recalculée à chaque changement de
  // date/heure, pour marquer les salles déjà occupées dans le menu ci-dessous.
  const availabilityQuery = useQuery({
    queryKey: ['room-availability', date, heureDebut, heureFin],
    queryFn: () => rooms.checkAvailability({ date, heureDebut, heureFin }),
    enabled: open && !!date && heureFin > heureDebut,
  });
  const availabilityByName = new Map((availabilityQuery.data ?? []).map((a) => [a.salleNom.toLowerCase(), a]));

  // Pré-remplit la salle avec celle rattachée par défaut à la classe (task
  // #229) — reste une simple valeur de départ, modifiable comme les autres.
  useEffect(() => {
    if (!open || salle || !classQuery.data?.defaultRoomId || !roomList.data) return;
    const defaultRoom = roomList.data.find((r) => r.id === classQuery.data?.defaultRoomId);
    if (defaultRoom) setSalle(defaultRoom.nom);
  }, [open, classQuery.data?.defaultRoomId, roomList.data, salle]);

  const mutation = useMutation({
    mutationFn: (input: Omit<ClassEvent, 'id' | 'matiere' | 'professeur'>) => classes.planEvent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-events', classId] });
      reset();
      onClose();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Erreur inattendue.'),
  });

  function reset() {
    setType('Devoir');
    setTitre('');
    setSubjectId('');
    setTeacherId('');
    setSemestre(1);
    setDate(todayISO());
    setHeureDebut('08:00');
    setHeureFin('09:00');
    setSalle('');
    setNotes('');
    setError(null);
  }

  function onSubmit() {
    if (!titre.trim() || !date) {
      setError('Le titre et la date sont obligatoires.');
      return;
    }
    if (type !== 'Conseil de classe' && !subjectId) {
      setError('Choisissez une matière.');
      return;
    }
    if (!teacherId) {
      setError('Choisissez le professeur responsable.');
      return;
    }
    if (heureFin <= heureDebut) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    setError(null);
    mutation.mutate({
      classeId: classId,
      type,
      titre: titre.trim(),
      subjectId: type === 'Conseil de classe' ? null : subjectId,
      teacherId,
      semestre,
      date: isoToFR(date),
      heureDebut,
      heureFin,
      salle: salle.trim() || null,
      notes: notes.trim(),
    });
  }

  return (
    <Sheet
      title="Planifier une échéance"
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button id="ce-save" variant="primary" onClick={onSubmit} loading={mutation.isPending}>
            Planifier
          </Button>
        </>
      }
    >
      <Field label="Type">
        <Select value={type} onChange={(e) => setType(e.target.value as EventType)}>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Intitulé" required>
        <Input id="ce-titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Devoir n°2" />
      </Field>
      {type !== 'Conseil de classe' ? (
        <Field label="Matière" required hint="Liste des matières enseignées dans cette classe.">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">— Choisir une matière —</option>
            {classSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Professeur responsable" required>
        <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">— Choisir un professeur —</option>
          {classTeachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nom}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Semestre">
        <Select value={semestre} onChange={(e) => setSemestre(Number(e.target.value) as 1 | 2)}>
          <option value={1}>Semestre 1</option>
          <option value={2}>Semestre 2</option>
        </Select>
      </Field>
      <Field label="Date" required>
        <DateInput id="ce-date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Heure de début" required>
          <Input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
        </Field>
        <Field label="Heure de fin" required>
          <Input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
        </Field>
      </div>
      <Field
        label="Salle (optionnel)"
        hint={salle && availabilityByName.get(salle.toLowerCase())?.disponible === false ? 'Cette salle est déjà occupée à ce créneau.' : undefined}
      >
        <Select value={salle} onChange={(e) => setSalle(e.target.value)}>
          <option value="">— Aucune —</option>
          {(roomList.data ?? []).map((r) => {
            const avail = availabilityByName.get(r.nom.toLowerCase());
            const unavailable = avail ? !avail.disponible : false;
            return (
              <option key={r.id} value={r.nom} disabled={unavailable}>
                {r.nom}{unavailable ? ' — occupée' : ''}
              </option>
            );
          })}
        </Select>
      </Field>
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
    </Sheet>
  );
}
