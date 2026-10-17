import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Field, Input, Select, Sheet } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { StaffStatus, Subject, Teacher, TeacherLookupResult } from '@/types/domain';

/**
 * Pas de composant « multi-select » dans `components/ui` à ce jour — une
 * liste de cases à cocher suffit pour un nombre de matières par
 * établissement qui reste limité (quelques dizaines au plus).
 */
function SubjectCheckboxList({
  subjects,
  selectedIds,
  onToggle,
}: {
  subjects: Subject[];
  selectedIds: string[];
  onToggle(subjectId: string): void;
}) {
  if (subjects.length === 0) {
    return <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Aucune matière créée pour le moment.</p>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {subjects.map((sub) => (
        <label
          key={sub.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: 999,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <input type="checkbox" checked={selectedIds.includes(sub.id)} onChange={() => onToggle(sub.id)} />
          {sub.nom}
        </label>
      ))}
    </div>
  );
}

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
  const { teachers, subjects } = useServices();
  const queryClient = useQueryClient();
  const isNew = !teacher;

  const subjectList = useQuery({ queryKey: ['subjects'], queryFn: () => subjects.list(), enabled: open });

  const [phase, setPhase] = useState<CreationPhase>('recherche');
  const [searchTel, setSearchTel] = useState('');
  const [lookupResult, setLookupResult] = useState<TeacherLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [subjectIdsAttache, setSubjectIdsAttache] = useState<string[]>([]);

  const [nom, setNom] = useState('');
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [statut, setStatut] = useState<StaffStatus>('actif');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase(isNew ? 'recherche' : 'formulaire');
      setSearchTel('');
      setLookupResult(null);
      setLookupError(null);
      setSubjectIdsAttache([]);
      setNom(teacher?.nom ?? '');
      setSubjectIds(teacher?.subjectIds ?? []);
      setTel(teacher?.tel ?? '');
      setEmail(teacher?.email ?? '');
      setStatut(teacher?.statut ?? 'actif');
      setError(null);
    }
  }, [open, teacher, isNew]);

  function toggleSubject(ids: string[], setIds: (ids: string[]) => void, subjectId: string) {
    setIds(ids.includes(subjectId) ? ids.filter((id) => id !== subjectId) : [...ids, subjectId]);
  }

  const lookupMutation = useMutation({
    mutationFn: () => teachers.findByPhone(searchTel.trim()),
    onSuccess: (result) => {
      setLookupError(null);
      if (result) {
        setLookupResult(result);
        setSubjectIdsAttache([]);
        setPhase('trouve');
      } else {
        setTel(searchTel.trim());
        setPhase('formulaire');
      }
    },
  });

  const attachMutation = useMutation({
    mutationFn: () => teachers.attachExisting(lookupResult!.userId, subjectIdsAttache),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      onClose();
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      teachers.create({ nom: nom.trim(), subjectIds, tel: tel.trim() || '—', email: email.trim() || '—' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      teachers.update(teacher!.id, {
        nom: nom.trim(),
        subjectIds,
        tel: tel.trim() || '—',
        email: email.trim() || '—',
        statut,
      }),
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
            <Field label="Matière(s)">
              <SubjectCheckboxList
                subjects={subjectList.data ?? []}
                selectedIds={subjectIdsAttache}
                onToggle={(id) => toggleSubject(subjectIdsAttache, setSubjectIdsAttache, id)}
              />
            </Field>
          )}
        </>
      ) : (
        <>
          <Field label="Nom complet" required>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. M. Ousmane Diop" />
          </Field>
          <Field label="Matière(s)">
            <SubjectCheckboxList
              subjects={subjectList.data ?? []}
              selectedIds={subjectIds}
              onToggle={(id) => toggleSubject(subjectIds, setSubjectIds, id)}
            />
          </Field>
          <Field label="Téléphone">
            <Input value={tel} onChange={(e) => setTel(e.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {!isNew ? (
            <Field label="Statut">
              <Select id="t-statut" value={statut} onChange={(e) => setStatut(e.target.value as StaffStatus)}>
                <option value="actif">Actif</option>
                <option value="suspendu">Suspendu</option>
                <option value="transfere">Transféré</option>
                <option value="en_attente">En attente d’activation</option>
              </Select>
            </Field>
          ) : null}
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
