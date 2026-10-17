import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DateInput,
  Field,
  Input,
  Select,
  Sheet,
  StateView,
  Table,
  Textarea,
  type Column,
} from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { AppError } from '@/services/errors';
import { fmtXOF, isoToFR } from '@/utils/format';
import type {
  PaymentChannel,
  PaymentTransaction,
  PaymentTransactionStatus,
  PaymentType,
  RestoTicketPurchase,
  RestoTicketStatus,
  StudentPickerEntry,
} from '@/types/domain';

const TYPE_LABEL: Record<PaymentType, string> = {
  inscription_seule: 'Inscription seule',
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  annuel: 'Annuel',
  inscription_mensuel: 'Inscription + mensuel',
  inscription_trimestriel: 'Inscription + trimestriel',
  inscription_annuel: 'Inscription + annuel',
  bourse: 'Bourse',
};

/** Types sélectionnables pour un encaissement manuel — "bourse" est calculé automatiquement, jamais saisi. */
const RECORDABLE_TYPES: PaymentType[] = [
  'inscription_seule',
  'mensuel',
  'trimestriel',
  'annuel',
  'inscription_mensuel',
  'inscription_trimestriel',
  'inscription_annuel',
];

const STATUS_LABEL: Record<PaymentTransactionStatus, string> = {
  en_attente: 'En attente',
  complete: 'Complété',
  echoue: 'Échoué',
  rembourse: 'Remboursé',
  en_retard: 'En retard',
};
const STATUS_TONE: Record<PaymentTransactionStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  en_attente: 'warning',
  complete: 'success',
  echoue: 'danger',
  rembourse: 'info',
  en_retard: 'danger',
};

const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  especes: 'Espèces',
  cheque: 'Chèque',
  virement_bancaire: 'Virement bancaire',
};

const TICKET_STATUS_LABEL: Record<RestoTicketStatus, string> = {
  emis: 'Émis',
  utilise: 'Utilisé',
  expire: 'Expiré',
  annule: 'Annulé',
};
const TICKET_STATUS_TONE: Record<RestoTicketStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  emis: 'info',
  utilise: 'success',
  expire: 'warning',
  annule: 'danger',
};

export default function PaymentsPage() {
  const { students, payments, restoTickets } = useServices();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [student, setStudent] = useState<StudentPickerEntry | null>(null);

  const search = useQuery({
    queryKey: ['students-search', searchQuery],
    queryFn: () => students.search(searchQuery),
    enabled: searchQuery.trim().length >= 2,
  });

  const history = useQuery({
    queryKey: ['payments-history', student?.id],
    queryFn: () => payments.getHistory(student!.id),
    enabled: student != null,
  });
  const tickets = useQuery({
    queryKey: ['resto-tickets-history', student?.id],
    queryFn: () => restoTickets.getHistory(student!.id),
    enabled: student != null,
  });

  const [recordOpen, setRecordOpen] = useState(false);
  const [type, setType] = useState<PaymentType>('mensuel');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('');
  const [installmentNumber, setInstallmentNumber] = useState('1');
  const [totalInstallments, setTotalInstallments] = useState('1');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [recordError, setRecordError] = useState<string | null>(null);

  function resetRecordForm() {
    setType('mensuel');
    setAmount('');
    setPeriod('');
    setInstallmentNumber('1');
    setTotalInstallments('1');
    setDueDate('');
    setNote('');
    setRecordError(null);
  }

  const recordMutation = useMutation({
    mutationFn: () =>
      payments.recordCash({
        studentId: student!.id,
        type,
        amountFcfa: Number(amount),
        period: period.trim() || undefined,
        installmentNumber: Number(installmentNumber) || 1,
        totalInstallments: Number(totalInstallments) || 1,
        dueDate: dueDate ? isoToFR(dueDate) : undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      setRecordOpen(false);
      resetRecordForm();
      queryClient.invalidateQueries({ queryKey: ['payments-history', student?.id] });
    },
    onError: (err: unknown) => {
      setRecordError(err instanceof AppError ? err.message : "Encaissement impossible.");
    },
  });

  async function openReceipt(transactionId: string, existingUrl: string | null) {
    const url = existingUrl ?? (await payments.getReceiptUrl(transactionId));
    window.open(url, '_blank', 'noreferrer');
  }

  const paymentColumns: Column<PaymentTransaction>[] = [
    { key: 'date', header: 'Date', render: (r) => r.datePaiement ?? r.dateCreation },
    { key: 'type', header: 'Type', render: (r) => TYPE_LABEL[r.type] },
    {
      key: 'echeance',
      header: 'Échéance',
      render: (r) => (r.echeancesTotal > 1 ? `${r.echeanceNumero}/${r.echeancesTotal}` : '—'),
    },
    {
      key: 'montant',
      header: 'Montant',
      align: 'right',
      render: (r) => (
        <>
          {fmtXOF(r.montantNetFcfa)}
          {r.remiseFcfa > 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
              dont {fmtXOF(r.remiseFcfa)} de remise bourse
            </div>
          ) : null}
        </>
      ),
    },
    { key: 'canal', header: 'Canal', render: (r) => CHANNEL_LABEL[r.canal] },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.statut]}>{STATUS_LABEL[r.statut]}</Badge> },
    {
      key: 'recu',
      header: 'Reçu',
      render: (r) =>
        r.statut === 'complete' ? (
          <button
            type="button"
            onClick={() => openReceipt(r.id, r.receiptUrl)}
            style={{ color: 'var(--brand-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
          >
            Voir le reçu
          </button>
        ) : (
          '—'
        ),
    },
  ];

  const ticketColumns: Column<RestoTicketPurchase>[] = [
    { key: 'type', header: 'Type de ticket', render: (r) => r.ticketTypeLabel },
    { key: 'prix', header: 'Prix', align: 'right', render: (r) => fmtXOF(r.prixFcfa) },
    { key: 'code', header: 'Code', render: (r) => r.codeAchat },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={TICKET_STATUS_TONE[r.statut]}>{TICKET_STATUS_LABEL[r.statut]}</Badge> },
    { key: 'achete', header: 'Acheté le', render: (r) => r.acheteLe },
    { key: 'utilise', header: 'Utilisé le', render: (r) => r.utiliseLe ?? '—' },
  ];

  if (!student) {
    return (
      <div>
        <PageHeader
          title="Paiements"
          subtitle="Recherchez un élève pour encaisser un paiement en espèces ou consulter son historique de paiements et de tickets resto."
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
        title={`Paiements — ${student.nom}`}
        subtitle={student.classe}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setStudent(null)}>
              Changer d'élève
            </Button>
            <Button variant="primary" onClick={() => setRecordOpen(true)}>
              Encaisser un paiement
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader title="Historique des paiements" />
        <StateView
          loading={history.isLoading}
          error={history.error}
          empty={(history.data ?? []).length === 0}
          emptyLabel="Aucun paiement enregistré."
          onRetry={() => history.refetch()}
        >
          <Table columns={paymentColumns} rows={history.data ?? []} rowKey={(r) => r.id} />
        </StateView>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <CardHeader title="Tickets de restaurant" />
        <StateView
          loading={tickets.isLoading}
          error={tickets.error}
          empty={(tickets.data ?? []).length === 0}
          emptyLabel="Aucun ticket acheté."
          onRetry={() => tickets.refetch()}
        >
          <Table columns={ticketColumns} rows={tickets.data ?? []} rowKey={(r) => r.id} />
        </StateView>
      </Card>

      <Sheet
        title="Encaisser un paiement"
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRecordOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" loading={recordMutation.isPending} disabled={!amount} onClick={() => recordMutation.mutate()}>
              Encaisser
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Field label="Type de paiement" required>
            <Select value={type} onChange={(e) => setType(e.target.value as PaymentType)}>
              {RECORDABLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Montant (FCFA)" required>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Période" hint='Facultatif, ex. "Trimestre 1".'>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="Échéance n°">
              <Input type="number" min={1} value={installmentNumber} onChange={(e) => setInstallmentNumber(e.target.value)} />
            </Field>
            <Field label="Sur un total de">
              <Input type="number" min={1} value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)} />
            </Field>
          </div>
          <Field label="Date d'échéance" hint="Facultatif.">
            <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Note" hint="Facultatif.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>
          {recordError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{recordError}</p> : null}
        </div>
      </Sheet>
    </div>
  );
}
