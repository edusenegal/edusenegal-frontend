import { useState, type FormEvent } from 'react';
import { roleLabel } from '@/utils/roles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Field, Input, Select, Sheet, StateView, Table, type Column, useConfirm } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import type { StaffMember, StaffStatus } from '@/types/domain';

/** Libellés affichés pour chaque rôle technique (UserRole). */
/** Rôles proposés à la création depuis l'espace direction. */
const CREATABLE_ROLES = [
  'CENSEUR',
  'SUPERVISOR',
  'ACCOUNTANT',
  'LIBRARIAN',
  'SECRETARY_GENERAL',
  'REGISTRAR',
  'IT_MANAGER',
  'CANTEEN_STAFF',
] as const;

const STATUS_TONE: Record<StaffStatus, 'success' | 'danger' | 'neutral' | 'warning'> = {
  actif: 'success',
  suspendu: 'danger',
  transfere: 'neutral',
  en_attente: 'warning',
};
const STATUS_LABEL: Record<StaffStatus, string> = {
  actif: 'Actif',
  suspendu: 'Bloqué',
  transfere: 'Transféré',
  en_attente: 'En attente',
};


export default function PersonnelListPage() {
  const { personnel } = useServices();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const listQuery = useQuery({ queryKey: ['personnel'], queryFn: () => personnel.list() });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [role, setRole] = useState<string>('CENSEUR');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [sexe, setSexe] = useState<'M' | 'F'>('M');
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setPrenom('');
    setNom('');
    setRole('CENSEUR');
    setTel('');
    setEmail('');
    setSexe('M');
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(m: StaffMember) {
    setEditing(m);
    setPrenom(m.prenom);
    setNom(m.nom);
    setRole(m.role);
    setTel(m.tel === '—' ? '' : m.tel);
    setEmail(m.email === '—' ? '' : m.email);
    setFormError(null);
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) {
        return personnel.update(editing.id, { prenom, nom, tel, email: email || '—' });
      }
      return personnel.create({ prenom, nom, role, tel, email: email || undefined, sexe });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      setFormOpen(false);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof AppError ? err.message : "Impossible d'enregistrer.");
    },
  });

  const blockMutation = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      blocked ? personnel.block(id) : personnel.unblock(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personnel'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => personnel.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personnel'] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prenom.trim() || !nom.trim() || !tel.trim()) {
      setFormError('Prénom, nom et téléphone sont obligatoires.');
      return;
    }
    saveMutation.mutate();
  }

  async function onToggleBlock(m: StaffMember) {
    const willBlock = m.statut !== 'suspendu';
    const msg = willBlock
      ? `Bloquer ${m.prenom} ${m.nom} ? La personne ne pourra plus se connecter.`
      : `Débloquer ${m.prenom} ${m.nom} ? Son accès sera rétabli.`;
    if (await confirm({ title: willBlock ? 'Bloquer' : 'Débloquer', message: msg, danger: willBlock })) blockMutation.mutate({ id: m.id, blocked: willBlock });
  }

  async function onRemove(m: StaffMember) {
    if (
      await confirm({
        title: 'Retirer du personnel',
        message: `Retirer ${m.prenom} ${m.nom} de l’établissement ? Cette action est définitive.`,
        danger: true,
      })
    ) {
      removeMutation.mutate(m.id);
    }
  }

  const columns: Column<StaffMember>[] = [
    { key: 'nom', header: 'Nom', render: (m) => `${m.prenom} ${m.nom}` },
    { key: 'role', header: 'Rôle', render: (m) => roleLabel(m.role) },
    { key: 'tel', header: 'Téléphone', render: (m) => m.tel },
    { key: 'email', header: 'Email', render: (m) => m.email },
    {
      key: 'statut',
      header: 'Statut',
      render: (m) => <Badge tone={STATUS_TONE[m.statut]}>{STATUS_LABEL[m.statut]}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (m) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
            Modifier
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onToggleBlock(m)}>
            {m.statut === 'suspendu' ? 'Débloquer' : 'Bloquer'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRemove(m)}>
            Supprimer
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Personnel"
        subtitle="Tout le personnel de l’établissement : enseignants, censeurs, surveillants, comptables, bibliothécaires…"
        action={
          <Button variant="primary" onClick={openCreate}>
            + Ajouter un membre
          </Button>
        }
      />

      <StateView
        loading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => listQuery.refetch()}
        empty={listQuery.data?.length === 0}
        emptyLabel="Aucun membre du personnel pour le moment."
      >
        <Table columns={columns} rows={listQuery.data ?? []} rowKey={(m) => m.id} />
      </StateView>

      <Sheet
        title={editing ? 'Modifier le membre' : 'Ajouter un membre du personnel'}
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
          <Field label="Prénom" required>
            <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
          </Field>
          <Field label="Nom" required>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} required />
          </Field>
          <Field label="Rôle" required>
            <Select value={role} onChange={(e) => setRole(e.target.value)} disabled={editing !== null}>
              {CREATABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </Select>
          </Field>
          {!editing ? (
            <Field label="Sexe">
              <Select value={sexe} onChange={(e) => setSexe(e.target.value as 'M' | 'F')}>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </Select>
            </Field>
          ) : null}
          <Field label="Téléphone" required>
            <Input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+221 77 000 00 00" required />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {formError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{formError}</p> : null}
        </form>
      </Sheet>
    </div>
  );
}
