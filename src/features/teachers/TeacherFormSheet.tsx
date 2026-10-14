import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Field, Input, Sheet } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { Teacher, TeacherLookupResult } from '@/types/domain';

interface TeacherFormSheetProps {
  open: boolean;
  onClose(): void;
  teacher?: Teacher | null;
}

type CreationPhase = 'recherche' | 'trouve' | 'formulaire';

/**
 * Création / édition d'un enseignant.
 *
 * À la création, une étape de recherche par téléphone précède le formulaire
 * — évite de créer un doublon si la personne existe déjà, potentiellement
 * rattachée à une autre école (voir `TeachersPort.findByPhone`). Si elle
 * existe, on propose de la rattacher à cet établissement plutôt que d'en
 * recréer une fiche ; sinon on enchaîne sur le formulaire de création, avec
 * le téléphone déjà recherché pré-rempli.
 *
 * Volontairement sans champ « classes » : les classes d'un enseignant se
 * gèrent uniquement depuis sa fiche (liste déroulante des classes de
 * l'établissement), jamais en texte libre ici.
 */
export function TeacherFormSheet({ open, onClose, teacher }: TeacherFormSheetProps) {
  const { teachers } = useServices();
  const queryClient = useQueryClient();
  const isNew = !teacher;

  const [phase, setPhase] = useState<CreationPhase>('recherche');
  const [searchTel, setSearchTel] = useState('');
  const [lookupResult, setLookupResult] = useState<TeacherLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [matiereAttache, setMatiereAttache] = useState('');

  const [nom, setNom] = useState('');
  const [matiere, setMatiere] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase(isNew ? 'recherche' : 'formulaire');
      setSearchTel('');
      setLookupResult(null);
      setLookupError(null);
      setMatiereAttache('');
      setNom(teacher?.nom ?? '');
      setMatiere(teacher?.matiere ?? '');
      setTel(teacher?.tel ?? '');
      setEmail(teacher?.email ?? '');
      setError(null);
    }
  }, [open, teacher, isNew]);

  const lookupMutation = useMutation({
    mutationFn: () => teachers.findByPhone(searchTel.trim()),
    onSuccess: (result) => {
      setLookupError(null);
      if (result) {
        setLookupResult(result);
        setMatiereAttache('');
        setPhase('trouve');
      } else {
        setTel(searchTel.trim());
        setPhase('formulaire');
      }
    },
  });

  const attachMutation = useMutation({
    mutationFn: () => teachers.attachExisting(lookupResult!.userId, matiereAttache.trim() || '—'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      onClose();
    },
  });

  const createMutation = useMutation({
    mutationFn: () => teachers.create({ nom: nom.trim(), matiere: matiere.trim() || '—', tel: tel.trim() || '—', email: email.trim() || '—' }),
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

  function onSearch() {
    if (!searchTel.trim()) {
      setLookupError('Saisissez un numéro de téléphone.');
      return;
    }
    setLookupError(null);
    lookupMutation.mutate();
  }

  function onSubmit() {
    if (!nom.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    if (isNew) createMutation.mutate();
    else updateMutation.mutate();
  }

  const title = isNew ? (phase === 'formulaire' ? 'Nouvel enseignant' : 'Rechercher un enseignant') : 'Modifier l’enseignant';

  const footer =
    phase === 'recherche' ? (
      <Button variant="primary" onClick={onSearch} loading={lookupMutation.isPending}>
        Rechercher
      </Button>
    ) : phase === 'trouve' ? (
      <>
        <Button variant="secondary" onClick={() => setPhase('recherche')}>
          Retour
        </Button>
        {!lookupResult?.dejaDansCetEtablissement ? (
          <Button variant="primary" onClick={() => attachMutation.mutate()} loading={attachMutation.isPending}>
            Attacher à cet établissement
          </Button>
        ) : null}
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="primary" onClick={onSubmit} loading={pending}>
          {isNew ? 'Créer' : 'Enregistrer'}
        </Button>
      </>
    );

  return (
    <Sheet title={title} open={open} onClose={onClose} footer={footer}>
      {phase === 'recherche' ? (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 10 }}>
            Recherchez d’abord par téléphone — si la personne existe déjà (même dans une autre école), on vous
            proposera de la rattacher plutôt que d’en créer un doublon.
          </p>
          <Field label="Téléphone" required>
            <Input value={searchTel} onChange={(e) => setSearchTel(e.target.value)} placeholder="Ex. 77 520 00 01" />
          </Field>
          {lookupError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{lookupError}</p> : null}
        </>
      ) : phase === 'trouve' && lookupResult ? (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '10px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 10,
            }}
          >
            <strong>{lookupResult.nom}</strong>
            <span style={{ color: 'var(--color-text-muted)' }}>{lookupResult.tel} · {lookupResult.email}</span>
            {lookupResult.dejaDansCetEtablissement ? (
              <Badge tone="warning">Déjà enseignant(e) dans cet établissement</Badge>
            ) : (
              <Badge tone="info">Utilisateur existant — à rattacher</Badge>
            )}
          </div>
          {lookupResult.dejaDansCetEtablissement ? (
            <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>
              Cette personne est déjà enseignante dans cet établissement — aucun rattachement nécessaire.
            </p>
          ) : (
            <Field label="Matière" required>
              <Input value={matiereAttache} onChange={(e) => setMatiereAttache(e.target.value)} />
            </Field>
          )}
        </>
      ) : (
        <>
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
              Les classes et la rémunération se gèrent depuis la fiche de l’enseignant une fois créé.
            </p>
          ) : null}
          {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
        </>
      )}
    </Sheet>
  );
}
