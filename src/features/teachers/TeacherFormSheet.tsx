import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, Sheet } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { Teacher } from '@/types/domain';

interface TeacherFormSheetProps {
  open: boolean;
  onClose(): void;
  teacher?: Teacher | null;
}

/**
 * Création / édition d'un enseignant.
 *
 * Volontairement sans champ « classes » : les classes d'un enseignant se
 * gèrent uniquement depuis sa fiche (liste déroulante des classes de
 * l'établissement), jamais en texte libre ici.
 */
export function TeacherFormSheet({ open, onClose, teacher }: TeacherFormSheetProps) {
  const { teachers } = useServices();
  const queryClient = useQueryClient();
  const isNew = !teacher;

  const [nom, setNom] = useState('');
  const [matiere, setMatiere] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNom(teacher?.nom ?? '');
      setMatiere(teacher?.matiere ?? '');
      setTel(teacher?.tel ?? '');
      setEmail(teacher?.email ?? '');
      setError(null);
    }
  }, [open, teacher]);

  const createMutation = useMutation({
    mutationFn: () => teachers.create({ nom: nom.trim(), matiere: matiere.trim() || '—', tel: tel.trim() || '—', email: email.trim() || '—', salaire: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      teachers.update(teacher!.id, { nom: nom.trim(), matiere: matiere.trim() || '—', tel: tel.trim() || '—', email: email.trim() || '—' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', teacher?.id] });
      onClose();
    },
  });

  const pending = createMutation.isPending || updateMutation.isPending;

  function onSubmit() {
    if (!nom.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    if (isNew) createMutation.mutate();
    else updateMutation.mutate();
  }

  return (
    <Sheet
      title={isNew ? 'Nouvel enseignant' : 'Modifier l’enseignant'}
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={onSubmit} loading={pending}>
            {isNew ? 'Créer' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <Field label="Nom complet" required>
        <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. M. Ousmane Diop" />
      </Field>
      <Field label="Matière">
        <Input value={matiere} onChange={(e) => setMatiere(e.target.value)} />
      </Field>
      <Field label="Téléphone">
        <Input value={tel} onChange={(e) => setTel(e.target.value)} />
      </Field>
      <Field label="E-mail">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {isNew ? (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: -4 }}>
          Les classes se gèrent depuis la fiche de l’enseignant une fois créé.
        </p>
      ) : null}
      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
    </Sheet>
  );
}
