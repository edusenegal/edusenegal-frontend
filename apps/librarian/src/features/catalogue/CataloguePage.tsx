import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, Input, Select, Sheet, StateView, Table, type Column, useConfirm } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import { WORK_TYPE_LABEL, type Copy, type Work, type WorkType } from '@/types/domain';

const WORK_TYPES: WorkType[] = ['livre', 'manuel', 'memoire', 'periodique', 'autre'];

export default function CataloguePage() {
  const { library } = useServices();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const worksQuery = useQuery({ queryKey: ['works', search], queryFn: () => library.listWorks(search) });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Work | null>(null);
  const [titre, setTitre] = useState('');
  const [auteur, setAuteur] = useState('');
  const [isbn, setIsbn] = useState('');
  const [type, setType] = useState<WorkType>('livre');
  const [categorie, setCategorie] = useState('');
  const [annee, setAnnee] = useState('');
  const [copies, setCopies] = useState('1');
  const [formError, setFormError] = useState<string | null>(null);

  const [copiesOf, setCopiesOf] = useState<Work | null>(null);
  const copiesQuery = useQuery({
    queryKey: ['copies', copiesOf?.id ?? ''],
    queryFn: () => library.listCopies(copiesOf?.id ?? ''),
    enabled: copiesOf !== null,
  });
  const [addCount, setAddCount] = useState('1');

  function openCreate() {
    setEditing(null);
    setTitre('');
    setAuteur('');
    setIsbn('');
    setType('livre');
    setCategorie('');
    setAnnee('');
    setCopies('1');
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(w: Work) {
    setEditing(w);
    setTitre(w.titre);
    setAuteur(w.auteur);
    setIsbn(w.isbn ?? '');
    setType(w.type);
    setCategorie(w.categorie);
    setAnnee(w.annee ? String(w.annee) : '');
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const anneeNum = annee.trim() ? Number(annee) : undefined;
      if (editing) {
        return library.updateWork(editing.id, {
          titre,
          auteur,
          isbn: isbn || null,
          type,
          categorie,
          annee: anneeNum ?? null,
        });
      }
      return library.createWork({ titre, auteur, isbn: isbn || undefined, type, categorie, annee: anneeNum, copies: Number(copies) || 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['works'] });
      queryClient.invalidateQueries({ queryKey: ['library-stats'] });
      setFormOpen(false);
    },
    onError: (err: unknown) => setFormError(err instanceof AppError ? err.message : "Impossible d'enregistrer."),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => library.archiveWork(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['works'] });
      queryClient.invalidateQueries({ queryKey: ['library-stats'] });
    },
  });

  const addCopiesMutation = useMutation({
    mutationFn: () => library.addCopies(copiesOf?.id ?? '', Number(addCount) || 1),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['copies', copiesOf?.id] });
      queryClient.invalidateQueries({ queryKey: ['works'] });
      setAddCount('1');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!titre.trim() || !auteur.trim() || !categorie.trim()) {
      setFormError('Titre, auteur et catégorie sont obligatoires.');
      return;
    }
    saveMutation.mutate();
  }

  async function onArchive(w: Work) {
    if (
      await confirm({
        title: 'Retirer du catalogue',
        message: `Retirer « ${w.titre} » du catalogue ? Les exemplaires seront supprimés.`,
        danger: true,
      })
    ) {
      archiveMutation.mutate(w.id);
    }
  }

  const columns: Column<Work>[] = [
    { key: 'titre', header: 'Titre', render: (w) => w.titre },
    { key: 'auteur', header: 'Auteur', render: (w) => w.auteur },
    { key: 'type', header: 'Type', render: (w) => WORK_TYPE_LABEL[w.type] },
    { key: 'categorie', header: 'Catégorie', render: (w) => w.categorie },
    {
      key: 'dispo',
      header: 'Disponibles',
      align: 'right',
      render: (w) => (
        <Badge tone={w.availableCopies > 0 ? 'success' : 'danger'}>
          {w.availableCopies}/{w.totalCopies}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (w) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => setCopiesOf(w)}>
            Exemplaires
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
            Modifier
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onArchive(w)}>
            Retirer
          </Button>
        </div>
      ),
    },
  ];

  const COPY_STATE_TONE = { disponible: 'success', emprunte: 'warning', reserve: 'info', perdu: 'danger', abime: 'danger' } as const;

  const copyColumns: Column<Copy>[] = [
    { key: 'barcode', header: 'Code-barres', render: (c) => c.barcode },
    { key: 'etat', header: 'État', render: (c) => <Badge tone={COPY_STATE_TONE[c.etat]}>{c.etat}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Catalogue"
        subtitle="Livres, manuels, mémoires et périodiques de la bibliothèque."
        action={
          <Button variant="primary" onClick={openCreate}>
            + Ajouter une œuvre
          </Button>
        }
      />

      <Card padded style={{ marginBottom: 16 }}>
        <Field label="Rechercher">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Titre, auteur ou catégorie…" />
        </Field>
      </Card>

      <StateView
        loading={worksQuery.isLoading}
        error={worksQuery.error}
        onRetry={() => worksQuery.refetch()}
        empty={worksQuery.data?.length === 0}
        emptyLabel="Aucune œuvre."
      >
        <Table columns={columns} rows={worksQuery.data ?? []} rowKey={(w) => w.id} />
      </StateView>

      <Sheet
        title={editing ? "Modifier l'œuvre" : 'Ajouter une œuvre'}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={onSubmit} loading={saveMutation.isPending}>
              {editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Titre" required>
            <Input value={titre} onChange={(e) => setTitre(e.target.value)} required />
          </Field>
          <Field label="Auteur" required>
            <Input value={auteur} onChange={(e) => setAuteur(e.target.value)} required />
          </Field>
          <Field label="Type" required>
            <Select value={type} onChange={(e) => setType(e.target.value as WorkType)}>
              {WORK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {WORK_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Catégorie" required>
            <Input value={categorie} onChange={(e) => setCategorie(e.target.value)} required />
          </Field>
          <Field label="ISBN">
            <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} />
          </Field>
          <Field label="Année">
            <Input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} />
          </Field>
          {!editing ? (
            <Field label="Nombre d'exemplaires" required>
              <Input type="number" min={1} value={copies} onChange={(e) => setCopies(e.target.value)} />
            </Field>
          ) : null}
          {formError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{formError}</p> : null}
        </form>
      </Sheet>

      <Sheet title={copiesOf ? `Exemplaires — ${copiesOf.titre}` : 'Exemplaires'} open={copiesOf !== null} onClose={() => setCopiesOf(null)}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
          <Field label="Ajouter des exemplaires">
            <Input type="number" min={1} value={addCount} onChange={(e) => setAddCount(e.target.value)} style={{ width: 120 }} />
          </Field>
          <Button variant="secondary" onClick={() => addCopiesMutation.mutate()} loading={addCopiesMutation.isPending}>
            Ajouter
          </Button>
        </div>
        <StateView loading={copiesQuery.isLoading} error={copiesQuery.error} empty={copiesQuery.data?.length === 0}>
          <Table columns={copyColumns} rows={copiesQuery.data ?? []} rowKey={(c) => c.id} />
        </StateView>
      </Sheet>
    </div>
  );
}
