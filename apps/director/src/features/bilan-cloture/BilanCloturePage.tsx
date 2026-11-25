import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF } from '@/utils/format';
import type { BilanAnnuel, NiveauReussite, SchoolRecoveryStats } from '@/types/domain';

/**
 * S4 — Bilan de clôture (académique + comptable), exportable en PDF.
 *
 * Académique : réutilise `bilanAnnuel.getBilan()` (taux de réussite, moyenne
 * générale, mentions, réussite par niveau, présence). Comptable : recouvrement
 * global de l'école via `paymentConfig.getSchoolRecovery()` (attendu / encaissé /
 * reste, taux de recouvrement, ventilation par canal et par niveau).
 *
 * Export PDF : une fenêtre d'impression autonome (pas de dépendance) — le
 * navigateur propose « Enregistrer en PDF ».
 */

const CHANNEL_LABEL: Record<string, string> = {
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  CASH: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT_BANCAIRE: 'Virement bancaire',
  BANK_CARD: 'Carte bancaire',
};

const pct = (n: number) => `${Math.round(n * 10) / 10} %`;

function exportPdf(bilan: BilanAnnuel, rec: SchoolRecoveryStats) {
  const channels = Object.entries(rec.byChannel).sort((a, b) => b[1] - a[1]);
  const niveaux = bilan.reussiteParNiveau;
  const row = (l: string, v: string) =>
    `<tr><td>${l}</td><td style="text-align:right;font-weight:600">${v}</td></tr>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Bilan de clôture — ${bilan.anneeActuelle}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;margin:32px;}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  .muted{color:#666;font-size:12px;margin:0 0 16px}
  table{border-collapse:collapse;width:100%;font-size:13px;margin-bottom:8px}
  td{padding:5px 8px;border-bottom:1px solid #eee}
  @media print{body{margin:12mm}}
</style></head><body>
<h1>Bilan de clôture — ${bilan.anneeActuelle}</h1>
<p class="muted">Établissement · année scolaire ${bilan.anneeActuelle}${bilan.anneePrecedente ? ` (réf. ${bilan.anneePrecedente})` : ''}</p>
<h2>Bilan académique</h2>
<table>
  ${row('Effectif', String(bilan.effectif.valeurActuelle))}
  ${row('Taux de réussite', pct(bilan.tauxReussite.valeurActuelle))}
  ${row('Moyenne générale', `${bilan.moyenneGenerale.valeurActuelle} / 20`)}
  ${row('Mentions obtenues', String(bilan.mentions))}
  ${row('Taux de présence', pct(bilan.tauxPresence.valeurActuelle))}
</table>
<h2>Réussite par niveau</h2>
<table>${niveaux.map((n: NiveauReussite) => row(`${n.niveau} (${n.effectif} élèves)`, pct(n.taux))).join('')}</table>
<h2>Bilan comptable</h2>
<table>
  ${row('Attendu', fmtXOF(rec.totalExpectedFcfa))}
  ${row('Encaissé', fmtXOF(rec.totalCollectedFcfa))}
  ${row('Reste à recouvrer', fmtXOF(rec.totalRemainingFcfa))}
  ${row('Taux de recouvrement', pct(rec.collectionRate))}
  ${row('Élèves soldés', String(rec.paidStudents))}
  ${row('Élèves en retard', String(rec.overdueStudents))}
</table>
<h2>Encaissements par canal</h2>
<table>${channels.length ? channels.map(([c, v]) => row(CHANNEL_LABEL[c] ?? c, fmtXOF(v))).join('') : row('Aucun encaissement', '—')}</table>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export default function BilanCloturePage() {
  const { bilanAnnuel, paymentConfig } = useServices();
  const bilan = useQuery({ queryKey: ['bilan-annuel'], queryFn: () => bilanAnnuel.getBilan() });
  const recovery = useQuery({ queryKey: ['school-recovery'], queryFn: () => paymentConfig.getSchoolRecovery() });

  const loading = bilan.isLoading || recovery.isLoading;
  const error = bilan.error ?? recovery.error;
  const ready = bilan.data && recovery.data;

  const niveauCols: Column<NiveauReussite>[] = [
    { key: 'niveau', header: 'Niveau', render: (n) => <strong>{n.niveau}</strong> },
    { key: 'effectif', header: 'Effectif', align: 'right', render: (n) => n.effectif },
    { key: 'taux', header: 'Taux de réussite', align: 'right', render: (n) => pct(n.taux) },
  ];

  const channelRows = recovery.data
    ? Object.entries(recovery.data.byChannel).sort((a, b) => b[1] - a[1]).map(([canal, montant]) => ({ canal, montant }))
    : [];
  const channelCols: Column<{ canal: string; montant: number }>[] = [
    { key: 'canal', header: 'Canal', render: (r) => CHANNEL_LABEL[r.canal] ?? r.canal },
    { key: 'montant', header: 'Encaissé', align: 'right', render: (r) => fmtXOF(r.montant) },
  ];

  return (
    <div>
      <PageHeader
        title="Bilan de clôture"
        subtitle="Synthèse académique et comptable de l’année — à archiver et partager."
        action={
          <Button
            variant="primary"
            disabled={!ready}
            onClick={() => ready && exportPdf(bilan.data!, recovery.data!)}
          >
            Exporter en PDF
          </Button>
        }
      />

      <StateView loading={loading} error={error}>
        {ready ? (
          <>
            <Card style={{ marginBottom: 16 }}>
              <CardHeader title={`Bilan académique · ${bilan.data!.anneeActuelle}`} />
              <div style={{ display: 'flex', gap: 12, padding: '12px 24px', flexWrap: 'wrap' }}>
                <Stat label="Effectif" value={String(bilan.data!.effectif.valeurActuelle)} />
                <Stat label="Taux de réussite" value={pct(bilan.data!.tauxReussite.valeurActuelle)} />
                <Stat label="Moyenne générale" value={`${bilan.data!.moyenneGenerale.valeurActuelle} / 20`} />
                <Stat label="Mentions" value={String(bilan.data!.mentions)} />
                <Stat label="Présence" value={pct(bilan.data!.tauxPresence.valeurActuelle)} />
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <CardHeader title="Réussite par niveau" />
              <StateView empty={bilan.data!.reussiteParNiveau.length === 0}>
                <Table columns={niveauCols} rows={bilan.data!.reussiteParNiveau} rowKey={(n) => n.niveau} />
              </StateView>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <CardHeader title="Bilan comptable — recouvrement" />
              <div style={{ display: 'flex', gap: 12, padding: '12px 24px', flexWrap: 'wrap' }}>
                <Stat label="Attendu" value={fmtXOF(recovery.data!.totalExpectedFcfa)} />
                <Stat label="Encaissé" value={fmtXOF(recovery.data!.totalCollectedFcfa)} />
                <Stat label="Reste à recouvrer" value={fmtXOF(recovery.data!.totalRemainingFcfa)} />
                <Stat label="Taux de recouvrement" value={pct(recovery.data!.collectionRate)} />
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '0 24px 16px', flexWrap: 'wrap' }}>
                <Badge tone="success">{recovery.data!.paidStudents} soldés</Badge>
                <Badge tone="warning">{recovery.data!.overdueStudents} en retard</Badge>
                <Badge tone="neutral">{recovery.data!.pendingStudents} en attente</Badge>
              </div>
            </Card>

            <Card>
              <CardHeader title="Encaissements par canal" />
              <StateView empty={channelRows.length === 0}>
                <Table columns={channelCols} rows={channelRows} rowKey={(r) => r.canal} />
              </StateView>
            </Card>
          </>
        ) : null}
      </StateView>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 150, padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}
