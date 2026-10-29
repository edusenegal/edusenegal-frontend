import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  DateInput,
  Field,
  Input,
  Segmented,
  Select,
  Sheet,
  StateView,
  Table,
  Textarea,
  type Column,
} from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import { fmtXOF, todayISO } from '@/utils/format';
import { exportRowsToXlsx } from '@/utils/xlsx';
import type { Expense, ExpenseCategory, ExpenseDecision, ExpenseStatus } from '@/types/domain';

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
  brouillon: 'Brouillon',
  en_attente: 'En attente',
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

const TABS: { value: ExpenseStatus | 'tous'; label: string }[] = [
  { value: 'tous', label: 'Toutes' },
  { value: 'brouillon', label: 'Brouillons' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'validee', label: 'Validées' },
  { value: 'rejetee', label: 'Rejetées' },
  { value: 'annulee', label: 'Annulées' },
];

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

export default function ExpensesPage() {
  const { expenses } = useServices();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<ExpenseStatus | 'tous'>('tous');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm());
  const [detail, setDetail] = useState<Expense | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Filtres comptables + pagination backend.
  const [categorie, setCategorie] = useState<ExpenseCategory | 'toutes'>('toutes');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const serverFilters = useMemo(
    () => ({
      status: tab === 'tous' ? undefined : (tab as ExpenseStatus),
      category: categorie === 'toutes' ? undefined : categorie,
      from: from || undefined,
      to: to || undefined,
      sort: 'created' as const,   // tri par dernière créée (demande comptabilité)
      page,
      size: PAGE_SIZE,
    }),
    [tab, categorie, from, to, page],
  );

  const list = useQuery({
    queryKey: ['expenses', serverFilters],
    queryFn: () => expenses.list(serverFilters),
  });

  const filtered = list.data?.content ?? [];
  const totalPages = list.data?.totalPages ?? 0;
  const totalElements = list.data?.total ?? 0;

  // Export Excel de la vue courante (mêmes filtres, toutes les pages).
  const exportMutation = useMutation({
    mutationFn: async () => {
      const all = await expenses.list({ ...serverFilters, page: 0, size: 5000 });
      const rows = all.content.map((e) => ({
        Date: e.dateDepense,
        Catégorie: CATEGORY_LABEL[e.categorie],
        Libellé: e.libelle,
        Fournisseur: e.fournisseur ?? '',
        'Montant (FCFA)': e.montantFcfa,
        Statut: STATUS_LABEL[e.statut],
      }));
      exportRowsToXlsx(`depenses_${new Date().toISOString().slice(0, 10)}`, rows, 'Dépenses');
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
  }

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
      invalidate();
      setCreateOpen(false);
      setForm(emptyForm());
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(err instanceof AppError ? err.message : 'Création impossible.'),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => expenses.submit(id),
    onSuccess: (updated) => {
      invalidate();
      setDetail(updated);
    },
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => expenses.cancel(id),
    onSuccess: (updated) => {
      invalidate();
      setDetail(updated);
    },
  });
  const validateMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ExpenseDecision }) =>
      expenses.validate(id, decision, decisionComment || undefined),
    onSuccess: (updated) => {
      invalidate();
      setDetail(updated);
      setDecisionComment('');
      setDecisionError(null);
    },
    // CORRECTION (bug signalé) : approuver une dépense alors que le solde de
    // l'école est insuffisant échouait silencieusement côté écran (seule
    // l'erreur backend était visible dans les journaux serveur) -- le
    // comptable doit en être informé directement ici.
    onError: (err: unknown) => setDecisionError(err instanceof AppError ? err.message : 'Action impossible.'),
  });
  const attachMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => expenses.attachFile(id, file),
    onSuccess: (updated) => {
      invalidate();
      setDetail(updated);
    },
  });

  // CORRECTION (demande explicite) : téléchargement authentifié d'un
  // justificatif -- jamais le lien MinIO présigné brut (voir downloadAttachment).
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const downloadAttachmentMutation = useMutation({
    mutationFn: ({ id, index, filename }: { id: string; index: number; filename: string }) =>
      expenses.downloadAttachment(id, index, filename),
    onSuccess: () => setAttachmentError(null),
    onError: (err: unknown) => setAttachmentError(err instanceof AppError ? err.message : 'Téléchargement impossible.'),
  });

  /** Nom de fichier lisible à partir de l'URL présignée (qui porte encore le nom d'origine dans son chemin). */
  function filenameFromAttachmentUrl(url: string, index: number): string {
    try {
      const last = new URL(url).pathname.split('/').pop() ?? '';
      const cleaned = decodeURIComponent(last).replace(/^[0-9a-f]{8}_/, '');
      return cleaned || `justificatif_${index + 1}`;
    } catch {
      return `justificatif_${index + 1}`;
    }
  }

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
    { key: 'fournisseur', header: 'Fournisseur', render: (r) => r.fournisseur ?? '—' },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.statut]}>{STATUS_LABEL[r.statut]}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => { setDetail(r); setDecisionError(null); }}>
            Détails
          </Button>
          {r.statut === 'brouillon' ? (
            <Button
              variant="secondary"
              size="sm"
              loading={submitMutation.isPending}
              onClick={() => submitMutation.mutate(r.id)}
            >
              Soumettre
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dépenses"
        subtitle="Demandes de paiement de l’établissement — saisie, soumission et décision finale du circuit de validation."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              loading={exportMutation.isPending}
              disabled={totalElements === 0}
              onClick={() => exportMutation.mutate()}
            >
              Exporter Excel
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>+ Nouvelle dépense</Button>
          </div>
        }
      />

      <Segmented
        value={tab}
        onChange={(v) => { setTab(v as ExpenseStatus | 'tous'); setPage(0); }}
        options={TABS.map((t) => ({ value: t.value, label: t.label }))}
      />

      <Card padded style={{ marginTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}>
          <Field label="Catégorie">
            <Select
              value={categorie}
              onChange={(e) => { setCategorie(e.target.value as ExpenseCategory | 'toutes'); setPage(0); }}
            >
              <option value="toutes">Toutes catégories</option>
              {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Du">
            <DateInput value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
          </Field>
          <Field label="Au">
            <DateInput value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
          </Field>
          <Button
            variant="ghost"
            onClick={() => { setCategorie('toutes'); setFrom(''); setTo(''); setTab('tous'); setPage(0); }}
          >
            Réinitialiser
          </Button>
        </div>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <StateView loading={list.isLoading} error={list.error} empty={filtered.length === 0}>
          <Table columns={columns} rows={filtered} rowKey={(r) => r.id} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {totalElements} dépense(s) · page {page + 1} / {Math.max(1, totalPages)}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Précédent
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                Suivant
              </Button>
            </div>
          </div>
        </StateView>
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

      <Sheet title="Détails de la dépense" open={detail != null} onClose={() => { setDetail(null); setDecisionError(null); }} width="lg">
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13 }}>
              <strong>{detail.libelle}</strong> · {CATEGORY_LABEL[detail.categorie]} ·{' '}
              <Badge tone={STATUS_TONE[detail.statut]}>{STATUS_LABEL[detail.statut]}</Badge>
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Montant : <strong>{fmtXOF(detail.montantFcfa)}</strong> · Date : {detail.dateDepense}
              {detail.fournisseur ? <> · Fournisseur : {detail.fournisseur}</> : null}
            </p>
            {detail.statut === 'rejetee' && detail.motifRejet ? (
              <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>Motif du rejet : {detail.motifRejet}</p>
            ) : null}
            {detail.statut === 'validee' && detail.soldeApresFcfa != null ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Solde avant : <strong>{fmtXOF(detail.soldeAvantFcfa ?? 0)}</strong> · Solde maintenant :{' '}
                <strong>{fmtXOF(detail.soldeApresFcfa)}</strong>
              </p>
            ) : null}

            <div style={{ display: 'flex', gap: 8 }}>
              {detail.statut === 'brouillon' ? (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={submitMutation.isPending}
                    onClick={() => submitMutation.mutate(detail.id)}
                  >
                    Soumettre
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(detail.id)}
                  >
                    Annuler la dépense
                  </Button>
                </>
              ) : null}
              {detail.statut === 'en_attente' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(detail.id)}
                >
                  Annuler la dépense
                </Button>
              ) : null}
            </div>

            {decisionError ? (
              <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{decisionError}</p>
            ) : null}
            {detail.statut === 'en_attente' ? (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 10 }}>
                <Field label="Commentaire (obligatoire pour un rejet)">
                  <Textarea value={decisionComment} onChange={(e) => setDecisionComment(e.target.value)} rows={2} />
                </Field>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={validateMutation.isPending}
                    onClick={() => validateMutation.mutate({ id: detail.id, decision: 'approuve' })}
                  >
                    Approuver
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={!decisionComment.trim()}
                    loading={validateMutation.isPending}
                    onClick={() => validateMutation.mutate({ id: detail.id, decision: 'rejete' })}
                  >
                    Rejeter
                  </Button>
                </div>
              </div>
            ) : null}

            <div>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 6px' }}>Justificatifs</p>
              {attachmentError ? (
                <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: '0 0 6px' }}>{attachmentError}</p>
              ) : null}
              {detail.piecesJointes.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Aucun justificatif déposé.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.piecesJointes.map((url, index) => {
                    const filename = filenameFromAttachmentUrl(url, index);
                    const isPending =
                      downloadAttachmentMutation.isPending &&
                      downloadAttachmentMutation.variables?.id === detail.id &&
                      downloadAttachmentMutation.variables?.index === index;
                    return (
                      <li key={url} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{filename}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={isPending}
                          onClick={() => downloadAttachmentMutation.mutate({ id: detail.id, index, filename })}
                        >
                          Télécharger
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {detail.statut !== 'annulee' ? (
                <input
                  type="file"
                  style={{ marginTop: 6, fontSize: 12.5 }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) attachMutation.mutate({ id: detail.id, file });
                  }}
                />
              ) : null}
            </div>

            {detail.historiqueValidation.length > 0 ? (
              <div>
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 6px' }}>
                  Historique de validation
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {detail.historiqueValidation.map((step, i) => (
                    <li key={i}>
                      {step.validatorRole.replace('ROLE_', '')} — {step.decision === 'approuve' ? 'Approuvé' : 'Rejeté'} le{' '}
                      {step.decideLe}
                      {step.commentaire ? ` — « ${step.commentaire} »` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
