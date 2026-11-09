import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, Select, Sheet, useConfirm } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { ScheduleSlot, Subject, Teacher } from '@/types/domain';

const DAYS: ScheduleSlot['jour'][] = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface ScheduleSlotSheetProps {
  classId: string;
  classSubjects: Subject[];
  classTeachers: Teacher[];
  open: boolean;
  onClose(): void;
  /** Créneau cliqué dans la grille — \`null\` pour un ajout, sinon édition de ce créneau précis. */
  editing: ScheduleSlot | null;
}

/**
 * Popup unique d'ajout/modification d'un créneau (nouvelle demande direction
 * — un seul bouton « Ajouter un créneau », et un créneau existant devient
 * cliquable → modifiable, au lieu du formulaire permanent affiché jusqu'ici
 * en haut de l'onglet « Emploi du temps »).
 */
export function ScheduleSlotSheet({ classId, classSubjects, classTeachers, open, onClose, editing }: ScheduleSlotSheetProps) {
  const { classes, rooms } = useServices();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [jour, setJour] = useState<ScheduleSlot['jour']>('Lundi');
  const [heureDebut, setHeureDebut] = useState('08:00');
  const [heureFin, setHeureFin] = useState('09:00');
  const [subjectId, setSubjectId] = useState('');
  const [enseignantId, setEnseignantId] = useState('');
  const [salle, setSalle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const classQuery = useQuery({ queryKey: ['class', classId], queryFn: () => classes.get(classId) });
  const roomList = useQuery({ queryKey: ['rooms'], queryFn: () => rooms.list() });
  const availabilityQuery = useQuery({
    queryKey: ['room-availability', jour, heureDebut, heureFin],
        queryFn: () => rooms.checkAvailability({ jour, heureDebut, heureFin }),
    enabled: open && heureFin > heureDebut,
  });
  const availabilityByName = new Map((availabilityQuery.data ?? []).map((a) => [a.salleNom.toLowerCase(), a]));

  // Repart à neuf (création) ou pré-rempli (édition) chaque fois que la popup s'ouvre.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setJour(editing.jour);
      setHeureDebut(editing.heureDebut);
      setHeureFin(editing.heureFin);
      setSubjectId(editing.subjectId ?? '');
      setEnseignantId(editing.enseignantId ?? '');
      setSalle(editing.salle ?? '');
    } else {
      setJour('Lundi');
      setHeureDebut('08:00');
      setHeureFin('09:00');
      setSubjectId('');
      setEnseignantId('');
      setSalle(classQuery.data?.defaultRoomId ? roomList.data?.find((r) => r.id === classQuery.data?.defaultRoomId)?.nom ?? '' : '');
    }
    setError(null);
  }, [open, editing, classQuery.data?.defaultRoomId, roomList.data]);

  function invalidateAndClose() {
    queryClient.invalidateQueries({ queryKey: ['class-schedule', classId] });
    onClose();
  }

  const saveMutation = useMutation({
    mutationFn: (slot: ScheduleSlot) =>
      editing
        ? classes.updateScheduleSlot(classId, { jour: editing.jour, heureDebut: editing.heureDebut }, slot)
        : classes.addScheduleSlot(classId, slot),
    onSuccess: invalidateAndClose,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Erreur inattendue.'),
  });

  const removeMutation = useMutation({
    mutationFn: () => classes.removeScheduleSlot(classId, { jour: editing!.jour, heureDebut: editing!.heureDebut }),
    onSuccess: invalidateAndClose,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Erreur inattendue.'),
  });

  function onSave() {
    if (!subjectId || !enseignantId) {
      setError('Choisissez une matière et un professeur.');
      return;
    }
    if (heureFin <= heureDebut) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    const subject = classSubjects.find((s) => s.id === subjectId);
    const teacher = classTeachers.find((t) => t.id === enseignantId);
    saveMutation.mutate({
      jour,
      heureDebut,
      heureFin,
      subjectId,
      matiere: subject?.nom ?? null,
      enseignantId,
      professeur: teacher?.nom ?? null,
      salle: salle.trim() || null,
      kind: 'cours',
    });
  }

  return (
    <Sheet
      title={editing ? 'Modifier le créneau' : 'Ajouter un créneau'}
      open={open}
      onClose={onClose}
      footer={
        <>
          {editing ? (
            <Button
              variant="ghost"
              loading={removeMutation.isPending}
              onClick={() => {
                void confirm({ title: 'Retirer le créneau', message: 'Retirer ce créneau de l’emploi du temps ?', danger: true }).then((ok) => { if (ok) removeMutation.mutate(); });
              }}
              style={{ marginRight: 'auto', color: 'var(--color-danger)' }}
            >
              Supprimer
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={saveMutation.isPending} onClick={onSave}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Field label="Jour">
          <Select value={jour} onChange={(e) => setJour(e.target.value as ScheduleSlot['jour'])}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Début">
          <Input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
        </Field>
        <Field label="Fin">
          <Input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
        </Field>
      </div>
      <Field label="Matière">
        <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">—</option>
          {classSubjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Professeur">
        <Select value={enseignantId} onChange={(e) => setEnseignantId(e.target.value)}>
          <option value="">—</option>
          {classTeachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nom}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Salle"
        hint={salle && availabilityByName.get(salle.toLowerCase())?.disponible === false ? 'Occupée à ce créneau.' : undefined}
      >
        <Select value={salle} onChange={(e) => setSalle(e.target.value)}>
          <option value="">—</option>
          {(roomList.data ?? []).map((r) => {
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
      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 6 }}>{error}</p> : null}
    </Sheet>
  );
}
