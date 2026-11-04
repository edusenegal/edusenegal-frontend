import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Field, Input, Select, Sheet, StateView, Table, type Column, useConfirm } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { ClassRoom } from '@/types/domain';

/**
 * Salles de classe (task #217) — catalogue de l'établissement, sélectionnable
 * lors de la création d'un créneau d'emploi du temps (fiche classe) ou d'un
 * examen (« Planifier une échéance »), avec vérification de disponibilité.
 *
 * Liaison à une classe dès la création (nouvelle demande direction) :
 * distincte de la salle PAR DÉFAUT d'une classe (`ClassDetailPage`, task
 * #229, qui part de la classe) — ici on part de LA SALLE. Backend
 * (`CreateClassRoomRequest.classId`) ne la reprend pas à la modification
 * (`UpdateClassRoomRequest`), donc le sélecteur n'apparaît qu'à la création.
 */
export default function RoomsPage() {
  const { rooms, classes } = useServices();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRoom | null>(null);
  const [nom, setNom] = useState('');
  const [capacite, setCapacite] = useState('');
  const [classeId, setClasseId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({ queryKey: ['rooms'], queryFn: () => rooms.list() });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });
  const classNameById = new Map((classList.data ?? []).map((c) => [c.id, c.name]));

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setNom('');
    setCapacite('');
    setClasseId('');
    setError(null);
  }

  function openCreate() {
    setEditing(null);
    setNom('');
    setCapacite('');
    setClasseId('');
    setError(null);
    setFormOpen(true);
  }

  function openEdit(room: ClassRoom) {
    setEditing(room);
    setNom(room.nom);
    setCapacite(room.capacite ? String(room.capacite) : '');
    setError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        return rooms.update(editing.id, { nom: nom.trim(), capacite: capacite.trim() ? Number(capacite) : 0 });
      }
      return rooms.create({ nom: nom.trim(), capacite: capacite.trim() ? Number(capacite) : 0, classeId: classeId || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      closeForm();
    },
    onError: (err: unknown) => setError(err instanceof AppError ? err.message : "Impossible d'enregistrer la salle."),
  });

  const removeMutation = useMutation({
    mutationFn: (roomId: string) => rooms.remove(roomId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });

  function onSave() {
    if (!nom.trim()) {
      setError('Le nom de la salle est obligatoire.');
      return;
    }
    setError(null);
    saveMutation.mutate();
  }

  const columns: Column<ClassRoom>[] = [
    { key: 'nom', header: 'Salle', render: (r) => <strong>{r.nom}</strong> },
    { key: 'capacite', header: 'Capacité', render: (r) => (r.capacite ? `${r.capacite} places` : '—') },
    { key: 'classe', header: 'Classe liée', render: (r) => (r.classeId ? classNameById.get(r.classeId) ?? r.classeId : '—') },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
          >
            Modifier
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              void confirm({ title: 'Supprimer la salle', message: `Supprimer la salle « ${r.nom} » ?`, danger: true }).then((ok) => { if (ok) removeMutation.mutate(r.id); });
            }}
          >
            Retirer
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Salles de classe"
        subtitle={`${list.data?.length ?? 0} salle(s) — sélectionnables lors de la création d’un créneau ou d’un examen.`}
        action={
          <Button variant="primary" onClick={openCreate}>
            + Ajouter une salle
          </Button>
        }
      />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(r) => r.id} />
        </StateView>
      </Card>

      <Sheet
        title={editing ? 'Modifier la salle' : 'Ajouter une salle'}
        open={formOpen}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Annuler
            </Button>
            <Button variant="primary" loading={saveMutation.isPending} onClick={onSave}>
              Enregistrer
            </Button>
          </>
        }
      >
        <Field label="Nom" required>
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Salle 101" />
        </Field>
        <Field label="Capacité (optionnel)">
          <Input type="number" min={0} value={capacite} onChange={(e) => setCapacite(e.target.value)} placeholder="Ex. 35" />
        </Field>
        {!editing ? (
          <Field label="Classe liée (optionnel)" hint="Rattache cette salle à une classe dès sa création.">
            <Select value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              <option value="">Aucune</option>
              {classList.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{error}</p> : null}
      </Sheet>
    </div>
  );
}
