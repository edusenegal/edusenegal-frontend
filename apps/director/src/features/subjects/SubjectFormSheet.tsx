import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, Sheet } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';

interface SubjectFormSheetProps {
  open: boolean;
  onClose(): void;
}

/**
 * Création d'une matière propre à l'établissement.
 *
 * Calqué sur `CreateSubjectRequest` côté backend (subject-service) : seuls
 * `code`, `names.fr` et `optional` sont saisis ici — `schoolId` est celui de
 * l'établissement, `global` reste `false` (les matières du catalogue global
 * se gèrent ailleurs), `schoolTypeScope` est toujours `LYCEE` pour cette
 * application.
 */
export function SubjectFormSheet({ open, onClose }: SubjectFormSheetProps) {
  const { subjects } = useServices();
  const queryClient = useQueryClient();

  const [code, setCode] = useState('');
  const [nom, setNom] = useState('');
  const [optionnelle, setOptionnelle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCode('');
    setNom('');
    setOptionnelle(false);
    setError(null);
  }

  const mutation = useMutation({
    mutationFn: () => subjects.create({ code: code.trim(), nom: nom.trim(), optionnelle }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      reset();
      onClose();
    },
    onError: (err: unknown) => {
      setError(err instanceof AppError ? err.message : 'Création impossible.');
    },
  });

  function onSubmit() {
    if (!code.trim() || !nom.trim()) {
      setError('Le code et le nom de la matière sont obligatoires.');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Sheet
      title="Nouvelle matière"
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
          <Button variant="primary" onClick={onSubmit} loading={mutation.isPending}>
            Créer
          </Button>
        </>
      }
    >
      <Field label="Code" required>
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Ex. SVT" />
      </Field>
      <Field label="Nom">
        <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Sciences de la Vie et de la Terre" />
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 4 }}>
        <input type="checkbox" checked={optionnelle} onChange={(e) => setOptionnelle(e.target.checked)} />
        Matière optionnelle
      </label>
      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{error}</p> : null}
    </Sheet>
  );
}
