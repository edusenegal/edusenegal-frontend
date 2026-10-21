import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, Select, Sheet } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { ClassLevel } from '@/types/domain';

const LEVELS: ClassLevel[] = ['Seconde', 'Première', 'Terminale'];

/**
 * Séries du lycée sénégalais — mêmes libellés que le backend attend dans
 * `ClassResponseDto.series`. Le backend ne contraint pas la série à un
 * niveau précis (c'est une convention d'établissement, pas une règle du
 * DTO) : le champ reste donc disponible et facultatif à tous les niveaux,
 * Seconde comprise.
 */
const SERIES: string[] = ['S1', 'S2', 'S3', 'L1', 'L2', 'L’', 'G', 'G2', 'T1', 'T2'];

interface ClassFormSheetProps {
  open: boolean;
  onClose(): void;
}

/**
 * Création d'une classe.
 *
 * Reprend le même triplet niveau/série/division que les fixtures
 * (`services/mock/fixtures.ts`, `classNameOf`) et que la forme réelle du
 * backend (`ClassResponseDto` — level/series/tag/capacity), pour que le nom
 * affiché soit construit de façon identique partout. Le professeur
 * principal est optionnel ici (`PUT /classes/{id}/homeroom-teacher/{id}`
 * côté backend) : on peut aussi l'affecter — ou le changer — plus tard
 * depuis la fiche de la classe.
 */
export function ClassFormSheet({ open, onClose }: ClassFormSheetProps) {
  const { classes, teachers } = useServices();
  const queryClient = useQueryClient();

  const teacherList = useQuery({ queryKey: ['teachers'], queryFn: () => teachers.list(), enabled: open });

  const [level, setLevel] = useState<ClassLevel>('Seconde');
  const [series, setSeries] = useState('');
  const [tag, setTag] = useState('');
  const [capacite, setCapacite] = useState('40');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setLevel('Seconde');
    setSeries('');
    setTag('');
    setCapacite('40');
    setHomeroomTeacherId('');
    setError(null);
  }

  const mutation = useMutation({
    mutationFn: () =>
      classes.create({
        level,
        series: series || null,
        tag: tag.trim() || null,
        capacite: Number(capacite),
        homeroomTeacherId: homeroomTeacherId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      if (homeroomTeacherId) queryClient.invalidateQueries({ queryKey: ['teachers'] });
      reset();
      onClose();
    },
    onError: (err: unknown) => {
      setError(err instanceof AppError ? err.message : 'Création impossible.');
    },
  });

  function onSubmit() {
    const cap = Number(capacite);
    if (!Number.isInteger(cap) || cap <= 0) {
      setError('La capacité doit être un nombre entier positif.');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Sheet
      title="Nouvelle classe"
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
      <Field label="Niveau" required>
        <Select value={level} onChange={(e) => setLevel(e.target.value as ClassLevel)}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Série" hint="Facultatif, à tous les niveaux.">
        <Select value={series} onChange={(e) => setSeries(e.target.value)}>
          <option value="">— Aucune —</option>
          {SERIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Division" hint="Champ libre, comme côté backend. Laisser vide s’il n’y a qu’une seule classe à ce niveau/série. Ex. A, B.">
        <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ex. A" />
      </Field>
      <Field label="Capacité" required>
        <Input type="number" min={1} value={capacite} onChange={(e) => setCapacite(e.target.value)} />
      </Field>
      <Field label="Professeur principal" hint="Facultatif ici — modifiable à tout moment depuis la fiche de la classe.">
        <Select value={homeroomTeacherId} onChange={(e) => setHomeroomTeacherId(e.target.value)}>
          <option value="">— À affecter plus tard —</option>
          {(teacherList.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.nom}
            </option>
          ))}
        </Select>
      </Field>
      {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
    </Sheet>
  );
}
