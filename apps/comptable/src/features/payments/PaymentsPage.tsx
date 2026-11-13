import { useMemo, useState } from 'react';
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
  ClassOption,
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
  const { students, payments, restoTickets, school } = useServices();
  const queryClient = useQueryClient();

  // ── Sélection : classe → élève ──────────────────────────────────────────
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [classSearch, setClassSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [student, setStudent] = useState<StudentPickerEntry | null>(null);

  const classesQuery = useQuery({ queryKey: ['classes-picker'], queryFn: () => students.listClasses() });
  const schoolQuery = useQuery({ queryKey: ['school-info'], queryFn: () => school.getSchool() });
  const allStudentsQuery = useQuery({
    queryKey: ['students-all'],
    queryFn: () => students.listAll(),
    enabled: selectedClass != null,
  });

  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    const list = classesQuery.data ?? [];
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [classesQuery.data, classSearch]);

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    const q = studentSearch.trim().toLowerCase();
    const list = (allStudentsQuery.data ?? []).filter((s) => s.classId === selectedClass.id);
    return q ? list.filter((s) => s.nom.toLowerCase().includes(q)) : list;
  }, [allStudentsQuery.data, selectedClass, studentSearch]);

  // ── Récap / solde de l'élève sélectionné ────────────────────────────────
  const progress = useQuery({
    queryKey: ['student-progress', student?.id, student?.classId],
    queryFn: () => payments.getStudentProgress(student!.id, student!.classId || undefined),
    enabled: student != null,
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

  const [detail, setDetail] = useState<PaymentTransaction | null>(null);
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

  function backToSelection() {
    setStudent(null);
    setStudentSearch('');
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
      queryClient.invalidateQueries({ queryKey: ['student-progress', student?.id] });
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
    {
      key: 'details',
      header: '',
      align: 'right',
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
          Détails
        </Button>
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

  // ── Étape sélection (classe puis élève) ─────────────────────────────────
  if (!student) {
    return (
      <div>
        <PageHeader
          title="Encaisser un paiement"
          subtitle="Choisissez la classe, puis l’élève, pour vérifier son solde et enregistrer un paiement."
        />

        {!selectedClass ? (
          <Card padded>
            <CardHeader title="1 · Choisir la classe" />
            <Field label="Rechercher une classe">
              <Input value={classSearch} onChange={(e) => setClassSearch(e.target.value)} placeholder="Ex: Terminale S2" />
            </Field>
            <StateView
              loading={classesQuery.isLoading}
              error={classesQuery.error}
              empty={filteredClasses.length === 0}
              emptyLabel="Aucune classe."
              onRetry={() => classesQuery.refetch()}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 10 }}>
                {filteredClasses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedClass(c);
                      setStudentSearch('');
                    }}
                    style={{
                      padding: '14px 16px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 12,
                      background: 'var(--color-surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      font: 'inherit',
                      fontWeight: 600,
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </StateView>
          </Card>
        ) : (
          <Card padded>
            <CardHeader
              title={`2 · Choisir l’élève — ${selectedClass.name}`}
              action={
                <Button variant="secondary" size="sm" onClick={() => setSelectedClass(null)}>
                  ← Changer de classe
                </Button>
              }
            />
            <Field label="Rechercher un élève">
              <Input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Nom ou prénom" />
            </Field>
            <StateView
              loading={allStudentsQuery.isLoading}
              error={allStudentsQuery.error}
              empty={classStudents.length === 0}
              emptyLabel="Aucun élève dans cette classe."
              onRetry={() => allStudentsQuery.refetch()}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {classStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStudent(s)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 10,
                      background: 'var(--color-surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      font: 'inherit',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{s.nom}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Voir le solde →</span>
                  </button>
                ))}
              </div>
            </StateView>
          </Card>
        )}
      </div>
    );
  }

  // ── Récap élève + encaissement ──────────────────────────────────────────
  const p = progress.data;

  return (
    <div>
      <PageHeader
        title="Encaissement"
        subtitle={student.classe}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={backToSelection}>
              Changer d’élève
            </Button>
            <Button variant="primary" onClick={() => setRecordOpen(true)}>
              Encaisser un paiement
            </Button>
          </div>
        }
      />

      {/* Carte récap moderne — identité de l'élève + solde */}
      <div
        style={{
          borderRadius: 18,
          padding: '22px 24px',
          marginBottom: 16,
          color: '#fff',
          background:
            'linear-gradient(135deg, var(--brand-primary, #0C241C) 0%, color-mix(in srgb, var(--brand-primary, #0C241C) 70%, #1D9E75) 100%)',
          boxShadow: '0 10px 30px -12px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.8 }}>Élève</div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, marginTop: 2 }}>{student.nom}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 999, padding: '4px 11px', fontSize: 12.5, fontWeight: 600 }}>
                {student.classe}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '4px 11px', fontSize: 12.5, fontWeight: 600 }}>
                École&nbsp;: {schoolQuery.data?.name ?? '…'}
              </span>
              {p?.scholarship ? (
                <span style={{ background: 'rgba(255,255,255,0.22)', borderRadius: 999, padding: '4px 11px', fontSize: 12.5, fontWeight: 700 }}>
                  Boursier · {p.scholarshipPercentage}%{p.scholarshipPayerName ? ` (${p.scholarshipPayerName})` : ''}
                </span>
              ) : null}
            </div>
          </div>

          <div style={{ textAlign: 'right', minWidth: 180 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.8 }}>Solde restant</div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 2 }}>
              {progress.isLoading ? '…' : fmtXOF(p?.remainingFcfa ?? 0)}
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>
              {progress.isLoading ? '' : `${p?.progressPercentage ?? 0}% réglé`}
            </div>
          </div>
        </div>

        {p ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 9, borderRadius: 999, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, p.progressPercentage))}%`,
                  background: '#fff',
                  borderRadius: 999,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginTop: 8, opacity: 0.92 }}>
              <span>Payé&nbsp;: {fmtXOF(p.paidFcfa)}</span>
              <span>Dû (net de bourse)&nbsp;: {fmtXOF(p.expectedNetFcfa)}</span>
            </div>
            {p.scholarship ? (
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                Scolarité totale {fmtXOF(p.expectedGrossFcfa)} · bourse déduite −{fmtXOF(p.scholarshipCoveredFcfa)}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <Button variant="primary" onClick={() => setRecordOpen(true)}>
            Encaisser un paiement
          </Button>
        </div>
      </div>

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
        title={`Encaisser — ${student.nom}`}
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
          {p ? (
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 6px' }}>
              {student.nom} · {student.classe} · solde restant <strong>{fmtXOF(p.remainingFcfa)}</strong>
            </p>
          ) : null}
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

      <Sheet title="Détails du paiement" open={detail != null} onClose={() => setDetail(null)} width="sm">
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13 }}>
              <strong>{TYPE_LABEL[detail.type]}</strong> ·{' '}
              <Badge tone={STATUS_TONE[detail.statut]}>{STATUS_LABEL[detail.statut]}</Badge>
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Montant net : <strong>{fmtXOF(detail.montantNetFcfa)}</strong>
              {detail.remiseFcfa > 0 ? <> (dont {fmtXOF(detail.remiseFcfa)} de remise bourse)</> : null} · Canal :{' '}
              {CHANNEL_LABEL[detail.canal]}
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Date de paiement : {detail.datePaiement ?? detail.dateCreation}
              {detail.period ? <> · Période : {detail.period}</> : null}
            </p>
            {detail.statut === 'complete' && detail.soldeApresFcfa != null ? (
              <p style={{ fontSize: 13 }}>
                Solde avant : <strong>{fmtXOF(detail.soldeAvantFcfa ?? 0)}</strong> · Solde maintenant :{' '}
                <strong>{fmtXOF(detail.soldeApresFcfa)}</strong>
              </p>
            ) : null}
            {detail.statut === 'complete' ? (
              <Button variant="secondary" size="sm" onClick={() => openReceipt(detail.id, detail.receiptUrl)}>
                Voir le reçu
              </Button>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
