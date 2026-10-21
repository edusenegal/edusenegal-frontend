import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, DateInput, Field, Input, Pager, Select, Sheet, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import { fmtXOF, todayISO } from '@/utils/format';
import type { Expense, ExpenseCategory, ExpenseStatus } from '@/types/domain';

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  salaires: 'Salaires',
  fournitures_bureau: 'Fournitures de bureau',
  materiel_pedagogique: 'Matériel pédagogique',
  electricite: 'Électricité',
  eau: 'Eau',
  internet: 'Internet',
  loyer: 'Loyer',
  maintenance: 'Maintenance',
  transport: 'Transport',
  communication: 'Communication',
  frais_bancaires: 'Frais bancaires',
  autres: 'Autres',
};

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  brouillon: 'Brouillon — en attente de soumission par la comptabilité',
  en_attente: 'En attente de validation',
  validee: 'Validée',
  rejetee: 'Rejetée',
  annulee: 'Annulée',
};
const STATUS_TONE: Record<ExpenseStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  brouillon: 'info',
  en_attente: 'warning',
  validee: 'success',
  rejetee: 'danger',
  annulee: 'info',
};

interface CreateForm {
  categorie: ExpenseCategory;
  libelle: string;
  montant: string;
  date: string;
  fournisseur: string;
}

function emptyForm(): CreateForm {
  return { categorie: 'fournitures_bureau', libelle: '', montant: '', date: todayISO(), fournisseur: '' };
}

/**
 * Demandes de paiement générales (task #218) — création et consultation
 * seulement : voir le commentaire de `ExpensesPort`. La soumission au
 * circuit de validation et la décision finale reviennent à la
 * comptabilité, dans sa propre application.
 */
export default function ExpensesPage() {
  const { expenses } = useServices();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm());
  const [detail, setDetail] = useState<Expense | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  /**
   * Pagination (nouvelle demande direction) — `list()` demandait
   * `size: 200` pour tout charger d'un coup ; `listPage` paginee vraiment,
   * voir le commentaire de `ExpensesPort.listPage`.
   */
  const list = useQuery({ queryKey: ['expenses', page], queryFn: () => expenses.listPage({ page, size: PAGE_SIZE }) });
  const expensesOnPage = list.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      expenses.create({
        categorie: form.categorie,
        libelle: form.libelle,
        montantFcfa: Number(form.montant),
        dateDepense: form.date.split('-').reverse().join('/'),
        fournisseur: form.fournisseur || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setCreateOpen(false);
      setForm(emptyForm());
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(err instanceof AppError ? err.message : 'Création impossible.'),
  });

  // Prévisualisation avant envoi (nouvelle demande direction) : le fichier
  // choisi n'est plus envoyé dès la sélection — il reste en attente, avec un
  // aperçu (miniature si c'est une image, nom sinon), jusqu'au clic sur
  // « Joindre ».
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFile || !pendingFile.type.startsWith('image/')) {
      setPendingPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const attachMutation = useMutation({
    mutationFn: (file: File) => expenses.attachFile(detail!.id, file),
    onSuccess: (updated) => {
      setDetail(updated);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setAttachError(null);
      setPendingFile(null);
    },
    onError: (err: unknown) => setAttachError(err instanceof AppError ? err.message : "Impossible de joindre ce fichier."),
  });

  function onSelectFile(file: File | null) {
    setPendingFile(file);
    setAttachError(null);
  }

  /** Dernier segment de l'URL, décodé — l'identifiant lisible du fichier dans ce prototype. */
  function attachmentName(url: string): string {
    const last = url.split('/').pop() ?? url;
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }

  const ATTACHABLE_STATUSES: ExpenseStatus[] = ['brouillon', 'en_attente'];

  function submitCreate() {
    setFormError(null);
    if (!form.libelle.trim() || !form.montant || Number(form.montant) <= 0) {
      setFormError('Le libellé et un montant positif sont obligatoires.');
      return;
    }
    createMutation.mutate();
  }

  function onCreate(event: FormEvent) {
    event.preventDefault();
    submitCreate();
  }

  const columns: Column<Expense>[] = [
    { key: 'categorie', header: 'Catégorie', render: (r) => CATEGORY_LABEL[r.categorie] },
    { key: 'libelle', header: 'Libellé', render: (r) => r.libelle },
    { key: 'montant', header: 'Montant', render: (r) => fmtXOF(r.montantFcfa), align: 'right' },
    { key: 'date', header: 'Date', render: (r) => r.dateDepense },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.statut]}>{STATUS_LABEL[r.statut].split(' —')[0]}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
          Détails
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dépenses"
        subtitle="Demandes de paiement générales de l’établissement — la soumission au circuit de validation et la décision finale sont faites par la comptabilité."
        action={<Button variant="primary" onClick={() => setCreateOpen(true)}>+ Nouvelle dépense</Button>}
      />

      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={expensesOnPage.length === 0}>
          <Table columns={columns} rows={expensesOnPage} rowKey={(r) => r.id} />
        </StateView>
        <Pager
          page={page}
          totalPages={list.data?.totalPages ?? 1}
          totalElements={list.data?.totalElements ?? 0}
          onChange={setPage}
        />
      </Card>

      <Sheet
        title="Nouvelle dépense"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        width="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" loading={createMutation.isPending} onClick={submitCreate}>
              Créer
            </Button>
          </>
        }
      >
        <form onSubmit={onCreate} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Field label="Catégorie" required>
            <Select
              value={form.categorie}
              onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value as ExpenseCategory }))}
            >
              {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Libellé" required>
            <Input value={form.libelle} onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))} />
          </Field>
          <Field label="Montant (FCFA)" required>
            <Input
              type="number"
              min={1}
              value={form.montant}
              onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
            />
          </Field>
          <Field label="Date de la dépense" required>
            <DateInput value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </Field>
          <Field label="Fournisseur">
            <Input value={form.fournisseur} onChange={(e) => setForm((f) => ({ ...f, fournisseur: e.target.value }))} />
          </Field>
          {formError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{formError}</p> : null}
        </form>
      </Sheet>

      <Sheet
        title="Détails de la dépense"
        open={detail != null}
        onClose={() => {
          setDetail(null);
          setAttachError(null);
        }}
        width="md"
      >
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13 }}>
              <strong>{detail.libelle}</strong> · {CATEGORY_LABEL[detail.categorie]}
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Montant : <strong>{fmtXOF(detail.montantFcfa)}</strong> · Date : {detail.dateDepense}
              {detail.fournisseur ? <> · Fournisseur : {detail.fournisseur}</> : null}
            </p>
            <p style={{ fontSize: 13 }}>
              <Badge tone={STATUS_TONE[detail.statut]}>{STATUS_LABEL[detail.statut]}</Badge>
            </p>
            {detail.statut === 'rejetee' && detail.motifRejet ? (
              <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>Motif du rejet : {detail.motifRejet}</p>
            ) : null}

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Pièces jointes</p>
              {detail.piecesJointes.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Aucun justificatif joint.</p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 0, margin: 0, listStyle: 'none' }}>
                  {detail.piecesJointes.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                        📎 {attachmentName(url)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {ATTACHABLE_STATUSES.includes(detail.statut) ? (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="file"
                    disabled={attachMutation.isPending}
                    onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
                    style={{ fontSize: 13 }}
                  />
                  {pendingFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {pendingPreviewUrl ? (
                        <img
                          src={pendingPreviewUrl}
                          alt="Aperçu du justificatif"
                          style={{ width: 48, height: 48, objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: 6 }}
                        />
                      ) : null}
                      <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                        {pendingFile.name} — pas encore joint.
                      </span>
                      <Button
                        variant="primary"
                        loading={attachMutation.isPending}
                        onClick={() => attachMutation.mutate(pendingFile)}
                        style={{ marginLeft: 'auto' }}
                      >
                        Joindre
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
                  Dépense {(STATUS_LABEL[detail.statut].split(' —')[0] ?? '').toLowerCase()} — plus de pièce jointe possible.
                </p>
              )}
              {attachError ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 6 }}>{attachError}</p> : null}
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
