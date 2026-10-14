import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, DateInput, Field, Input, Select, Sheet } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { frToISO, isoToFR } from '@/utils/format';
import type { Student, StudentStatus } from '@/types/domain';

interface StudentEditSheetProps {
  open: boolean;
  onClose(): void;
  student: Student | null;
}

export function StudentEditSheet({ open, onClose, student }: StudentEditSheetProps) {
  const { students } = useServices();
  const queryClient = useQueryClient();

  const [tel, setTel] = useState('');
  const [parent, setParent] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [statut, setStatut] = useState<StudentStatus>('actif');

  useEffect(() => {
    if (open && student) {
      setTel(student.tel);
      setParent(student.parent);
      setDateNaissance(frToISO(student.dateNaissance));
      setStatut(student.statut);
    }
  }, [open, student]);

  const mutation = useMutation({
    mutationFn: () =>
      students.update(student!.id, {
        tel,
        parent,
        dateNaissance: isoToFR(dateNaissance),
        statut,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      onClose();
    },
  });

  if (!student) return null;

  return (
    <Sheet
      title={`${student.prenom} ${student.nom}`}
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <Field label="Date de naissance" required>
        <DateInput id="m-naissance" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} />
      </Field>
      <Field label="Parent / tuteur">
        <Input id="m-parent" value={parent} onChange={(e) => setParent(e.target.value)} />
      </Field>
      <Field label="Téléphone">
        <Input id="m-tel" value={tel} onChange={(e) => setTel(e.target.value)} />
      </Field>
      <Field label="Statut">
        <Select id="m-statut" value={statut} onChange={(e) => setStatut(e.target.value as StudentStatus)}>
          <option value="actif">Actif</option>
          <option value="suspendu">Suspendu</option>
          <option value="transfere">Transféré</option>
        </Select>
      </Field>
    </Sheet>
  );
}
