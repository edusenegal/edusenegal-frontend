import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, DateInput, Field, Input, Select, Sheet } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import { isoToFR, todayISO } from '@/utils/format';
import type { Student } from '@/types/domain';

interface StudentFormSheetProps {
  open: boolean;
  onClose(): void;
  /** Présélectionne la classe — utile depuis la fiche d'une classe. */
  defaultClassId?: string;
}

/**
 * Création d'un élève.
 *
 * Champs calqués sur `CreateUserRequest` côté backend (user-service) :
 * prénom/nom/sexe/date de naissance/téléphone/classe — un seul tuteur ici
 * (`parent`, texte libre), le backend acceptant jusqu'à 3 `parentIds` une
 * fois les comptes parents reliés, hors périmètre de cette branche mock.
 */
export function StudentFormSheet({ open, onClose, defaultClassId }: StudentFormSheetProps) {
  const { students, classes } = useServices();
  const queryClient = useQueryClient();

  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list(), enabled: open });

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [sexe, setSexe] = useState<Student['sexe']>('F');
  const [classeId, setClasseId] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [tel, setTel] = useState('');
  const [parent, setParent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setClasseId(defaultClassId ?? '');
  }, [open, defaultClassId]);

  function reset() {
    setPrenom('');
    setNom('');
    setSexe('F');
    setClasseId(defaultClassId ?? '');
    setDateNaissance('');
    setTel('');
    setParent('');
    setError(null);
  }

  const mutation = useMutation({
    mutationFn: () =>
      students.create({
        prenom: prenom.trim(),
        nom: nom.trim(),
        sexe,
        classeId,
        dateNaissance: dateNaissance ? isoToFR(dateNaissance) : isoToFR(todayISO()),
        tel: tel.trim() || '—',
        parent: parent.trim() || '—',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['class', classeId] });
      reset();
      onClose();
    },
    onError: (err: unknown) => {
      setError(err instanceof AppError ? err.message : 'Création impossible.');
    },
  });

  function onSubmit() {
    if (!prenom.trim() || !nom.trim()) {
      setError('Le prénom et le nom sont obligatoires.');
      return;
    }
    if (!classeId) {
      setError('Choisissez la classe de l’élève.');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Sheet
      title="Nouvel élève"
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Prénom" required>
          <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Ex. Awa" />
        </Field>
        <Field label="Nom" required>
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Ndiaye" />
        </Field>
      </div>
      <Field label="Classe" required>
        <Select value={classeId} onChange={(e) => setClasseId(e.target.value)}>
          <option value="">— Choisir une classe —</option>
          {classList.data?.map((c) => (
            <option key={c.id} value={c.id} disabled={c.effectif >= c.capacite}>
              {c.name} ({c.effectif}/{c.capacite}
              {c.effectif >= c.capacite ? ' — complète' : ''})
            </option>
          ))}
        </Select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Sexe" required>
          <Select value={sexe} onChange={(e) => setSexe(e.target.value as Student['sexe'])}>
            <option value="F">Féminin</option>
            <option value="M">Masculin</option>
          </Select>
        </Field>
        <Field label="Date de naissance">
          <DateInput value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} />
        </Field>
      </div>
      <Field label="Téléphone (élève ou tuteur)">
        <Input value={tel} onChange={(e) => setTel(e.target.value)} />
      </Field>
      <Field label="Parent / tuteur">
        <Input value={parent} onChange={(e) => setParent(e.target.value)} placeholder="Ex. Mme Fatou Ndiaye" />
      </Field>
      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
    </Sheet>
  );
}
