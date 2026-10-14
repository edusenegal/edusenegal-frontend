import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  const { classes } = useServices();
  const queryClient = useQueryClient();

  const [type, setType] = useState<EventType>('Devoir');
  const [titre, setTitre] = useState('');
  const [matiere, setMatiere] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: Omit<ClassEvent, 'id'>) => classes.planEvent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-events', classId] });
      reset();
      onClose();
    },
  });

  function reset() {
    setType('Devoir');
    setTitre('');
    setMatiere('');
    setDate(todayISO());
    setNotes('');
    setError(null);
  }

  function onSubmit() {
    if (!titre.trim() || !date) {
      setError('Le titre et la date sont obligatoires.');
      return;
    }
    mutation.mutate({
      classeId: classId,
      type,
      titre: titre.trim(),
      matiere: matiere.trim() || null,
      date: isoToFR(date),
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
      <Field label="Matière" hint="Laisser vide si l’échéance concerne toutes les matières.">
        <Input value={matiere} onChange={(e) => setMatiere(e.target.value)} placeholder="Ex. Mathématiques" />
      </Field>
      <Field label="Date" required>
        <DateInput id="ce-date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
    </Sheet>
  );
}
