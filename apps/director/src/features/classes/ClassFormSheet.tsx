import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, Select, Sheet } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { ClassGroup, ClassLevel } from '@/types/domain';

const LEVELS: ClassLevel[] = ['Seconde', 'Première', 'Terminale'];

/**
 * Séries du lycée sénégalais — mêmes libellés que le backend attend dans
 * `ClassResponseDto.series`. Le champ reste facultatif à tous les niveaux.
 */
const SERIES: string[] = ['S1', 'S2', 'S3', 'L1', 'L2', 'L’', 'G', 'G2', 'T1', 'T2'];

interface ClassFormSheetProps {
  open: boolean;
  onClose(): void;
  /**
   * Fournie en mode ÉDITION : seuls le tag (division) et l'effectif limite
   * sont modifiables — le niveau et la série sont l'identité de la classe
   * (verrouillés, comme côté backend `PUT /classes/{id}`).
   */
  editing?: ClassGroup | null;
}

/**
 * Création ou modification d'une classe. En création, tout est saisi ; en
 * édition, seuls la division et l'effectif limite sont ouverts.
 */
export function ClassFormSheet({ open, onClose, editing = null }: ClassFormSheetProps) {
  const { classes, teachers } = useServices();
  const queryClient = useQueryClient();
  const isEdit = !!editing;

  const teacherList = useQuery({
    queryKey: ['teachers'],
    queryFn: () => teachers.list(),
    enabled: open && !isEdit,
  });

  const [level, setLevel] = useState<ClassLevel>('Seconde');
  const [series, setSeries] = useState('');
  const [tag, setTag] = useState('');
  const [capacite, setCapacite] = useState('40');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setLevel(editing.level);
      setSeries(editing.series ?? '');
      setTag(editing.tag ?? '');
      setCapacite(String(editing.capacite));
      setHomeroomTeacherId(editing.homeroomTeacherId ?? '');
    } else {
      setLevel('Seconde');
      setSeries('');
      setTag('');
      setCapacite('40');
      setHomeroomTeacherId('');
    }
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? classes.update(editing!.id, { tag: tag.trim() || null, capacite: Number(capacite) })
        : classes.create({
            level,
            series: series || null,
            tag: tag.trim() || null,
            capacite: Number(capacite),
            homeroomTeacherId: homeroomTeacherId || null,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['class', editing!.id] });
      if (!isEdit && homeroomTeacherId) queryClient.invalidateQueries({ queryKey: ['teachers'] });
      onClose();
    },
    onError: (err: unknown) => {
      setError(err instanceof AppError ? err.message : isEdit ? 'Modification impossible.' : 'Création impossible.');
    },
  });

  function onSubmit() {
    const cap = Number(capacite);
    if (!Number.isInteger(cap) || cap <= 0) {
      setError('L’effectif limite doit être un nombre entier positif.');
      return;
    }
    if (isEdit && editing && cap < editing.effectif) {
      setError(`L’effectif limite (${cap}) ne peut pas être inférieur aux ${editing.effectif} élève(s) déjà inscrit(s).`);
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Sheet
      title={isEdit ? 'Modifier la classe' : 'Nouvelle classe'}
      open={open}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={onSubmit} loading={mutation.isPending}>
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <Field label="Niveau" required hint={isEdit ? 'Non modifiable — identité de la classe.' : undefined}>
        <Select value={level} onChange={(e) => setLevel(e.target.value as ClassLevel)} disabled={isEdit}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Série" hint={isEdit ? 'Non modifiable — identité de la classe.' : 'Facultatif, à tous les niveaux.'}>
        <Select value={series} onChange={(e) => setSeries(e.target.value)} disabled={isEdit}>
          <option value="">— Aucune —</option>
          {SERIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Division" hint="Champ libre. Laisser vide s’il n’y a qu’une seule classe à ce niveau/série. Ex. A, B.">
        <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ex. A" />
      </Field>
      <Field label="Effectif limite" required hint={isEdit ? `Au moins ${editing?.effectif ?? 0} (élèves déjà inscrits).` : undefined}>
        <Input type="number" min={1} value={capacite} onChange={(e) => setCapacite(e.target.value)} />
      </Field>
      {!isEdit ? (
        <Field label="Professeur principal" hint="Facultatif ici — modifiable depuis la fiche de la classe.">
          <Select value={homeroomTeacherId} onChange={(e) => setHomeroomTeacherId(e.target.value)}>
            <option value="">— À affecter plus tard —</option>
            {(teacherList.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
    </Sheet>
  );
}
