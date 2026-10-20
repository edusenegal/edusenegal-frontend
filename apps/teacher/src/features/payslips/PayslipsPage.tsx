import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Sheet, StateView, Table, Textarea, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF } from '@/utils/format';
import type { CashPaymentNotice, PaymentChannel, SalarySlip } from '@/types/domain';

const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  especes: 'Espèces',
  cheque: 'Chèque',
  virement_bancaire: 'Virement bancaire',
};

export default function PayslipsPage() {
  const { payslips } = useServices();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['payslips', 'mine'], queryFn: () => payslips.mine() });
  const noticesQuery = useQuery({
    queryKey: ['payslips', 'cash-notices'],
    queryFn: () => payslips.pendingCashNotices(),
  });

  const [selected, setSelected] = useState<SalarySlip | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Ligne (requestId) dont le formulaire "motif de contestation" est ouvert.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const downloadMutation = useMutation({
    mutationFn: (payslipId: string) => payslips.downloadPdf(payslipId),
    onSuccess: () => setDownloadError(null),
    onError: (e) => setDownloadError(e instanceof Error ? e.message : 'Échec du téléchargement.'),
  });

  function refreshAfterDecision() {
    queryClient.invalidateQueries({ queryKey: ['payslips', 'cash-notices'] });
    // La confirmation génère un nouveau bulletin — rafraîchi aussi.
    queryClient.invalidateQueries({ queryKey: ['payslips', 'mine'] });
  }

  const confirmMutation = useMutation({
    mutationFn: (requestId: string) => payslips.confirmCashReceipt(requestId),
    onSuccess: refreshAfterDecision,
  });
  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => payslips.rejectCashReceipt(requestId, rejectReason.trim() || undefined),
    onSuccess: () => {
      refreshAfterDecision();
      setRejectingId(null);
      setRejectReason('');
    },
  });

  const columns: Column<SalarySlip>[] = [
    { key: 'periode', header: 'Période', render: (p) => p.periode },
    { key: 'montant', header: 'Montant brut', render: (p) => fmtXOF(p.montantBrut) },
    {
      key: 'detail',
      header: 'Détail',
      render: (p) =>
        p.salaryMode === 'par_jour'
          ? `${p.joursTravailles ?? 0} j. travaillé(s)`
          : p.salaryMode === 'par_heure'
            ? `${p.heuresTravaillees ?? 0} h. travaillée(s)`
            : 'Salaire fixe',
    },
    { key: 'date', header: 'Généré le', render: (p) => p.dateGeneration },
  ];

  return (
    <div>
      <PageHeader title="Ma fiche de paie" subtitle="Historique de vos bulletins de salaire." />

      {noticesQuery.data && noticesQuery.data.length > 0 ? (
        <Card padded style={{ marginBottom: 16 }}>
          <CardHeader title="Avis de paiement en espèces" />
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
            Le comptable indique vous avoir réglé ce salaire en espèces — confirmez l'avoir bien reçu pour que votre
            bulletin soit généré, ou contestez si ce n'est pas le cas.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {noticesQuery.data.map((n: CashPaymentNotice) => (
              <div
                key={n.requestId}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{n.periode}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                      {fmtXOF(n.montantFcfa)} en espèces{n.valideLe ? ` · validé le ${n.valideLe}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={confirmMutation.isPending && confirmMutation.variables === n.requestId}
                      onClick={() => confirmMutation.mutate(n.requestId)}
                    >
                      J'ai reçu ce paiement
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setRejectingId(rejectingId === n.requestId ? null : n.requestId);
                        setRejectReason('');
                      }}
                    >
                      Contester
                    </Button>
                  </div>
                </div>
                {rejectingId === n.requestId ? (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Expliquez pourquoi (optionnel) — ex. argent jamais remis."
                      rows={2}
                    />
                    {rejectMutation.isError ? (
                      <p style={{ color: 'var(--color-danger)', fontSize: 12.5, margin: 0 }}>
                        Échec de l'envoi de la contestation.
                      </p>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={rejectMutation.isPending}
                        onClick={() => rejectMutation.mutate(n.requestId)}
                      >
                        Confirmer la contestation
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRejectingId(null)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table
            columns={columns}
            rows={list.data ?? []}
            rowKey={(p) => p.id}
            onRowClick={(p) => {
              setSelected(p);
              setDownloadError(null);
            }}
          />
        </StateView>
      </Card>

      <Sheet
        title={selected ? `Fiche de paie — ${selected.periode}` : 'Fiche de paie'}
        open={selected !== null}
        onClose={() => setSelected(null)}
        width="sm"
        footer={
          selected ? (
            <Button
              variant="primary"
              loading={downloadMutation.isPending}
              onClick={() => downloadMutation.mutate(selected.id)}
            >
              Télécharger le PDF
            </Button>
          ) : undefined
        }
      >
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
            <Row label="Période" value={selected.periode} />
            <Row label="Montant brut" value={fmtXOF(selected.montantBrut)} />
            <Row
              label="Mode de rémunération"
              value={
                selected.salaryMode === 'par_jour'
                  ? 'Par jour travaillé'
                  : selected.salaryMode === 'par_heure'
                    ? 'Par heure travaillée'
                    : 'Fixe'
              }
            />
            {selected.joursTravailles != null ? <Row label="Jours travaillés" value={String(selected.joursTravailles)} /> : null}
            {selected.heuresTravaillees != null ? <Row label="Heures travaillées" value={String(selected.heuresTravaillees)} /> : null}
            {selected.joursAbsenceInjustifiee != null ? (
              <Row label="Absences injustifiées" value={`${selected.joursAbsenceInjustifiee} j.`} />
            ) : null}
            <Row label="Moyen de paiement" value={selected.modePaiement ? CHANNEL_LABEL[selected.modePaiement] : '—'} />
            <Row label="Généré le" value={selected.dateGeneration} />
            {downloadError ? <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>{downloadError}</p> : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: '1px solid var(--color-border)', paddingTop: 6 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
