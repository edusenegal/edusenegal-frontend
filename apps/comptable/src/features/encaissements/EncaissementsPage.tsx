import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Field, DateInput, Select, StateView, StatTile, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF } from '@/utils/format';
import { exportRowsToXlsx } from '@/utils/xlsx';
import type { IncomeRow, PaymentChannel, PaymentTransactionStatus, PaymentType } from '@/types/domain';

const TYPE_LABEL: Record<PaymentType, string> = {
  inscription_seule: 'Inscription',
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  annuel: 'Annuel',
  inscription_mensuel: 'Inscription + mensuel',
  inscription_trimestriel: 'Inscription + trimestriel',
  inscription_annuel: 'Inscription + annuel',
  bourse: 'Bourse',
};
const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  especes: 'Espèces',
  cheque: 'Chèque',
  virement_bancaire: 'Virement',
};
const TX_STATUS_LABEL: Record<PaymentTransactionStatus, string> = {
  en_attente: 'En attente',
  complete: 'Encaissé',
  echoue: 'Échoué',
  rembourse: 'Remboursé',
  en_retard: 'En retard',
};

const PAGE_SIZE = 20;

export default function EncaissementsPage() {
  const { payments } = useServices();
  const [type, setType] = useState<PaymentType | 'tous'>('tous');
  const [channel, setChannel] = useState<PaymentChannel | 'tous'>('tous');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const filters = useMemo(
    () => ({
      type: type === 'tous' ? undefined : type,
      channel: channel === 'tous' ? undefined : channel,
      from: from || undefined,
      to: to || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [type, channel, from, to, page],
  );

  const query = useQuery({
    queryKey: ['encaissements', filters],
    queryFn: () => payments.getIncomes(filters),
  });

  const rows = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const totalElements = query.data?.total ?? 0;
  const totalMontant = useMemo(() => rows.reduce((a, r) => a + r.montantNetFcfa, 0), [rows]);

  const exportMutation = useMutation({
    mutationFn: async () => {
      const all = await payments.getIncomes({ ...filters, page: 0, size: 5000 });
      const data = all.content.map((t) => ({
        Date: t.datePaiement ?? t.dateCreation,
        Élève: t.studentNom,
        Type: TYPE_LABEL[t.type] ?? t.type,
        Période: t.period ?? '',
        Canal: CHANNEL_LABEL[t.canal] ?? t.canal,
        'Montant brut (FCFA)': t.montantFcfa,
        'Remise bourse (FCFA)': t.remiseFcfa,
        'Montant net (FCFA)': t.montantNetFcfa,
        Statut: TX_STATUS_LABEL[t.statut],
      }));
      exportRowsToXlsx(`encaissements_${new Date().toISOString().slice(0, 10)}`, data, 'Encaissements');
    },
  });

  const columns: Column<IncomeRow>[] = [
    { key: 'date', header: 'Date', render: (t) => t.datePaiement ?? t.dateCreation },
    { key: 'eleve', header: 'Élève', render: (t) => t.studentNom },
    { key: 'type', header: 'Type', render: (t) => TYPE_LABEL[t.type] ?? t.type },
    { key: 'periode', header: 'Période', render: (t) => t.period ?? '—' },
    { key: 'canal', header: 'Canal', render: (t) => CHANNEL_LABEL[t.canal] ?? t.canal },
    { key: 'montant', header: 'Montant net', align: 'right', render: (t) => fmtXOF(t.montantNetFcfa) },
  ];

  function reset() {
    setType('tous');
    setChannel('tous');
    setFrom('');
    setTo('');
    setPage(0);
  }

  return (
    <div>
      <PageHeader
        title="Encaissements"
        subtitle="Paiements encaissés — filtrez par date, type ou canal, puis exportez la vue vers Excel."
        action={
          <Button
            variant="secondary"
            loading={exportMutation.isPending}
            disabled={totalElements === 0}
            onClick={() => exportMutation.mutate()}
          >
            Exporter Excel
          </Button>
        }
      />

      <Card padded style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'end' }}>
          <Field label="Type">
            <Select value={type} onChange={(e) => { setType(e.target.value as PaymentType | 'tous'); setPage(0); }}>
              <option value="tous">Tous les types</option>
              {(Object.keys(TYPE_LABEL) as PaymentType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Canal">
            <Select value={channel} onChange={(e) => { setChannel(e.target.value as PaymentChannel | 'tous'); setPage(0); }}>
              <option value="tous">Tous les canaux</option>
              {(Object.keys(CHANNEL_LABEL) as PaymentChannel[]).map((c) => (
                <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Du">
            <DateInput value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
          </Field>
          <Field label="Au">
            <DateInput value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
          </Field>
          <Button variant="ghost" onClick={reset}>Réinitialiser</Button>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 12 }}>
        <StatTile label="Encaissements (page)" value={String(rows.length)} />
        <StatTile label="Total encaissé (page)" value={fmtXOF(totalMontant)} tone="success" />
        <StatTile label="Total (tous filtres)" value={String(totalElements)} />
      </div>

      <Card style={{ marginTop: 0 }}>
        <StateView loading={query.isLoading} error={query.error} empty={rows.length === 0} onRetry={() => query.refetch()}>
          <Table columns={columns} rows={rows} rowKey={(t) => t.id} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {totalElements} encaissement(s) · page {page + 1} / {Math.max(1, totalPages)}
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
    </div>
  );
}
