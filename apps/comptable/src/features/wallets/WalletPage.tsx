import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Sheet,
  StateView,
  StatTile,
  Table,
  Textarea,
  type Column,
} from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import { fmtXOF } from '@/utils/format';
import type { StudentPickerEntry, WalletCreditType, WalletTransaction } from '@/types/domain';

const TYPE_LABEL: Record<WalletTransaction['type'], string> = {
  bourse: 'Bourse',
  achat_ticket: 'Achat ticket resto',
  credit_manuel: 'Crédit manuel',
  debit_manuel: 'Débit manuel',
  remboursement: 'Remboursement',
};

const CREDIT_TYPE_OPTIONS: { value: WalletCreditType; label: string }[] = [
  { value: 'bourse', label: 'Versement de bourse (réconcilié)' },
  { value: 'remboursement', label: 'Remboursement' },
  { value: 'credit_manuel', label: 'Crédit manuel (motif requis)' },
];

export default function WalletPage() {
  const { students, wallet } = useServices();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [student, setStudent] = useState<StudentPickerEntry | null>(null);

  const search = useQuery({
    queryKey: ['students-search', searchQuery],
    queryFn: () => students.search(searchQuery),
    enabled: searchQuery.trim().length >= 2,
  });

  const walletQuery = useQuery({
    queryKey: ['wallet', student?.id],
    queryFn: () => wallet.get(student!.id),
    enabled: student != null,
  });
  const historyQuery = useQuery({
    queryKey: ['wallet-history', student?.id],
    queryFn: () => wallet.getHistory(student!.id),
    enabled: student != null,
  });

  const [creditOpen, setCreditOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditType, setCreditType] = useState<WalletCreditType>('bourse');
  const [creditNote, setCreditNote] = useState('');
  const [creditError, setCreditError] = useState<string | null>(null);

  const [debitOpen, setDebitOpen] = useState(false);
  const [debitAmount, setDebitAmount] = useState('');
  const [debitNote, setDebitNote] = useState('');
  const [debitError, setDebitError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['wallet', student?.id] });
    queryClient.invalidateQueries({ queryKey: ['wallet-history', student?.id] });
  }

  const creditMutation = useMutation({
    mutationFn: () =>
      wallet.credit(student!.id, {
        amountFcfa: Number(creditAmount),
        type: creditType,
        note: creditNote.trim() || undefined,
      }),
    onSuccess: () => {
      setCreditOpen(false);
      setCreditAmount('');
      setCreditNote('');
      setCreditType('bourse');
      setCreditError(null);
      invalidate();
    },
    onError: (err: unknown) => {
      setCreditError(err instanceof AppError ? err.message : 'Crédit impossible.');
    },
  });

  const debitMutation = useMutation({
    mutationFn: () => wallet.debit(student!.id, { amountFcfa: Number(debitAmount), note: debitNote.trim() }),
    onSuccess: () => {
      setDebitOpen(false);
      setDebitAmount('');
      setDebitNote('');
      setDebitError(null);
      invalidate();
    },
    onError: (err: unknown) => {
      setDebitError(err instanceof AppError ? err.message : 'Débit impossible.');
    },
  });

  const historyColumns: Column<WalletTransaction>[] = [
    { key: 'date', header: 'Date', render: (r) => r.date },
    {
      key: 'type',
      header: 'Type',
      render: (r) => <Badge tone={r.credit ? 'success' : 'warning'}>{TYPE_LABEL[r.type]}</Badge>,
    },
    {
      key: 'montant',
      header: 'Montant',
      align: 'right',
      render: (r) => (
        <span style={{ color: r.credit ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {r.credit ? '+' : '−'}
          {fmtXOF(r.montantFcfa)}
        </span>
      ),
    },
    { key: 'solde', header: 'Solde après', align: 'right', render: (r) => fmtXOF(r.soldeApresFcfa) },
    { key: 'note', header: 'Note', render: (r) => r.note ?? '—' },
  ];

  if (!student) {
    return (
      <div>
        <PageHeader
          title="Portefeuilles élèves"
          subtitle="Recherchez un élève par nom pour consulter son solde ou enregistrer une correction manuelle."
        />
        <Card padded>
          <Field label="Rechercher un élève (nom ou prénom)">
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ex: Awa Diop" />
          </Field>

          {searchQuery.trim().length >= 2 ? (
            <StateView
              loading={search.isLoading}
              error={search.error}
              empty={(search.data ?? []).length === 0}
              emptyLabel="Aucun élève trouvé."
              onRetry={() => search.refetch()}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {(search.data ?? []).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStudent(s)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      background: 'var(--color-surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      font: 'inherit',
                    }}
                  >
                    <span>{s.nom}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{s.classe}</span>
                  </button>
                ))}
              </div>
            </StateView>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Portefeuille — ${student.nom}`}
        subtitle={`${student.classe} · solde interne non convertible, jamais une monnaie électronique.`}
        action={
          <Button variant="secondary" onClick={() => setStudent(null)}>
            Changer d'élève
          </Button>
        }
      />

      <StateView loading={walletQuery.isLoading} error={walletQuery.error} onRetry={() => walletQuery.refetch()}>
        {walletQuery.data ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <StatTile
                label="Solde"
                value={fmtXOF(walletQuery.data.soldeFcfa)}
                tone={walletQuery.data.soldeFcfa >= 0 ? 'success' : 'danger'}
              />
              <StatTile label="Total crédité" value={fmtXOF(walletQuery.data.totalCrediteFcfa)} tone="success" />
              <StatTile label="Total débité" value={fmtXOF(walletQuery.data.totalDebiteFcfa)} tone="warning" />
            </div>

            <Card style={{ marginTop: 12 }} padded>
              <CardHeader
                title={
                  walletQuery.data.derniereMajLe
                    ? `Dernière mise à jour : ${walletQuery.data.derniereMajLe}`
                    : "Aucun mouvement enregistré pour l'instant."
                }
                action={
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="secondary" onClick={() => setDebitOpen(true)}>
                      Débiter
                    </Button>
                    <Button variant="primary" onClick={() => setCreditOpen(true)}>
                      Créditer
                    </Button>
                  </div>
                }
              />
            </Card>
          </>
        ) : null}
      </StateView>

      <Card style={{ marginTop: 16 }}>
        <CardHeader title="Historique des mouvements" />
        <StateView
          loading={historyQuery.isLoading}
          error={historyQuery.error}
          empty={(historyQuery.data ?? []).length === 0}
          emptyLabel="Aucun mouvement."
          onRetry={() => historyQuery.refetch()}
        >
          <Table columns={historyColumns} rows={historyQuery.data ?? []} rowKey={(r) => r.id} />
        </StateView>
      </Card>

      <Sheet
        title="Créditer le portefeuille"
        open={creditOpen}
        onClose={() => setCreditOpen(false)}
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreditOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              loading={creditMutation.isPending}
              disabled={!creditAmount || (creditType === 'credit_manuel' && !creditNote.trim())}
              onClick={() => creditMutation.mutate()}
            >
              Créditer
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Field label="Montant (FCFA)" required>
            <Input type="number" min={0} value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} />
          </Field>
          <Field label="Nature du crédit" required>
            <Select value={creditType} onChange={(e) => setCreditType(e.target.value as WalletCreditType)}>
              {CREDIT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Note"
            required={creditType === 'credit_manuel'}
            hint={
              creditType === 'credit_manuel'
                ? 'Obligatoire pour un crédit manuel — précisez le motif.'
                : 'Facultatif.'
            }
          >
            <Textarea value={creditNote} onChange={(e) => setCreditNote(e.target.value)} rows={3} />
          </Field>
          {creditError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{creditError}</p> : null}
        </div>
      </Sheet>

      <Sheet
        title="Débiter le portefeuille"
        open={debitOpen}
        onClose={() => setDebitOpen(false)}
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDebitOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              loading={debitMutation.isPending}
              disabled={!debitAmount || !debitNote.trim()}
              onClick={() => debitMutation.mutate()}
            >
              Débiter
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Field label="Montant (FCFA)" required>
            <Input type="number" min={0} value={debitAmount} onChange={(e) => setDebitAmount(e.target.value)} />
          </Field>
          <Field label="Motif" required hint="Correction manuelle exceptionnelle — jamais un achat de ticket resto.">
            <Textarea value={debitNote} onChange={(e) => setDebitNote(e.target.value)} rows={3} />
          </Field>
          {debitError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{debitError}</p> : null}
        </div>
      </Sheet>
    </div>
  );
}
