import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Meter,
  Sheet,
  StateView,
  StatTile,
  Table,
  type Column,
} from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF } from '@/utils/format';
import type { PaymentChannel, PaymentTransaction, PaymentTransactionStatus, PaymentType } from '@/types/domain';

interface Row {
  studentId: string;
  nom: string;
  classe: string;
  classId: string;
  expected: number;
  collected: number;
  rate: number;
  status: string;
}
interface ClassRollup {
  classe: string;
  totalStudents: number;
  expected: number;
  collected: number;
  rate: number;
}

function rateTone(rate: number): 'success' | 'warning' | 'danger' {
  return rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger';
}

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Soldé',
  PARTIAL: 'Partiel',
  PENDING: 'En attente',
  OVERDUE: 'En retard',
  NONE: '—',
};
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'success',
  PARTIAL: 'warning',
  PENDING: 'neutral',
  OVERDUE: 'danger',
  NONE: 'neutral',
};

const TX_STATUS_LABEL: Record<PaymentTransactionStatus, string> = {
  en_attente: 'En attente',
  complete: 'Encaissé',
  echoue: 'Échoué',
  rembourse: 'Remboursé',
  en_retard: 'En retard',
};
const TX_STATUS_TONE: Record<PaymentTransactionStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  en_attente: 'neutral',
  complete: 'success',
  echoue: 'danger',
  rembourse: 'warning',
  en_retard: 'danger',
};
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

export default function RecouvrementPage() {
  const { students, payments } = useServices();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);
  const PAGE_SIZE = 20;
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['recouvrement-compta'],
    queryFn: async (): Promise<Row[]> => {
      const all = await students.listAll();
      const byId = new Map(all.map((s) => [s.id, s]));
      const collection = await payments.getCollection(all.map((s) => s.id));
      return collection.byStudent.map((r) => ({
        studentId: r.studentId,
        nom: byId.get(r.studentId)?.nom ?? r.studentId,
        classe: byId.get(r.studentId)?.classe ?? '—',
        classId: byId.get(r.studentId)?.classId ?? '',
        expected: r.expectedFcfa,
        collected: r.collectedFcfa,
        rate: r.collectionRate,
        status: r.status,
      }));
    },
  });

  const rows = query.data ?? [];

  const school = useMemo(() => {
    const expected = rows.reduce((a, r) => a + r.expected, 0);
    const collected = rows.reduce((a, r) => a + r.collected, 0);
    return {
      expected,
      collected,
      totalStudents: rows.length,
      rate: expected > 0 ? Math.round((collected / expected) * 1000) / 10 : 0,
    };
  }, [rows]);

  const byClass = useMemo<ClassRollup[]>(() => {
    const map = new Map<string, ClassRollup>();
    for (const r of rows) {
      const cur = map.get(r.classe) ?? { classe: r.classe, totalStudents: 0, expected: 0, collected: 0, rate: 0 };
      cur.totalStudents += 1;
      cur.expected += r.expected;
      cur.collected += r.collected;
      map.set(r.classe, cur);
    }
    return [...map.values()]
      .map((c) => ({ ...c, rate: c.expected > 0 ? Math.round((c.collected / c.expected) * 1000) / 10 : 0 }))
      .sort((a, b) => a.classe.localeCompare(b.classe));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => `${r.nom} ${r.classe}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  // ── Fiche détaillée (identité + progression + paiements) ─────────────────
  const detailQuery = useQuery({
    queryKey: ['recouvrement-detail', selected?.studentId, selected?.classId],
    enabled: selected != null,
    queryFn: async () => {
      const sid = selected!.studentId;
      const cid = selected!.classId || undefined;
      const [detail, progress, history] = await Promise.all([
        students.getDetail(sid, cid),
        payments.getStudentProgress(sid, cid),
        payments.getHistory(sid),
      ]);
      return { detail, progress, history };
    },
  });

  const alertMutation = useMutation({
    mutationFn: () => payments.sendStudentAlert(selected!.studentId, selected!.classId || undefined),
    onSuccess: () => setAlertMsg('Alerte de retard envoyée au parent/élève.'),
    onError: () => setAlertMsg("Échec de l'envoi de l'alerte. Réessayez."),
  });

  function openDetail(r: Row) {
    setSelected(r);
    setAlertMsg(null);
  }
  function closeDetail() {
    setSelected(null);
    setAlertMsg(null);
  }

  const classColumns: Column<ClassRollup>[] = [
    { key: 'classe', header: 'Classe', render: (c) => c.classe },
    { key: 'eleves', header: 'Élèves', align: 'right', render: (c) => String(c.totalStudents) },
    { key: 'du', header: 'Dû (net bourse)', align: 'right', render: (c) => fmtXOF(c.expected) },
    { key: 'encaisse', header: 'Encaissé', align: 'right', render: (c) => fmtXOF(c.collected) },
    {
      key: 'taux',
      header: 'Taux',
      render: (c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
          <Meter value={c.rate} tone={rateTone(c.rate)} />
          <span style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{c.rate}%</span>
        </div>
      ),
    },
  ];

  const studentColumns: Column<Row>[] = [
    { key: 'nom', header: 'Élève', render: (r) => r.nom },
    { key: 'classe', header: 'Classe', render: (r) => r.classe },
    { key: 'du', header: 'Dû (net bourse)', align: 'right', render: (r) => fmtXOF(r.expected) },
    { key: 'encaisse', header: 'Encaissé', align: 'right', render: (r) => fmtXOF(r.collected) },
    { key: 'taux', header: 'Taux', align: 'right', render: (r) => `${r.rate}%` },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{STATUS_LABEL[r.status] ?? r.status}</Badge> },
    { key: 'go', header: '', align: 'right', render: () => <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>Détails ›</span> },
  ];

  const paymentColumns: Column<PaymentTransaction>[] = [
    { key: 'date', header: 'Date', render: (t) => t.datePaiement ?? t.dateEcheance ?? t.dateCreation },
    { key: 'type', header: 'Type', render: (t) => TYPE_LABEL[t.type] ?? t.type },
    { key: 'periode', header: 'Période', render: (t) => t.period ?? '—' },
    { key: 'canal', header: 'Canal', render: (t) => CHANNEL_LABEL[t.canal] ?? t.canal },
    { key: 'montant', header: 'Montant net', align: 'right', render: (t) => fmtXOF(t.montantNetFcfa) },
    { key: 'statut', header: 'Statut', render: (t) => <Badge tone={TX_STATUS_TONE[t.statut]}>{TX_STATUS_LABEL[t.statut]}</Badge> },
  ];

  const progress = detailQuery.data?.progress;
  const isOverdue = progress != null && (progress.status === 'OVERDUE' || progress.remainingFcfa > 0);

  return (
    <div>
      <PageHeader
        title="Recouvrement"
        subtitle="Progression des paiements par élève et par classe. Le dû est net de bourse. Cliquez sur un élève pour sa fiche détaillée."
      />

      <StateView loading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
          <StatTile label="Taux de recouvrement" value={`${school.rate}%`} tone={rateTone(school.rate)} />
          <StatTile label="Dû (net de bourse)" value={fmtXOF(school.expected)} />
          <StatTile label="Encaissé" value={fmtXOF(school.collected)} tone="success" />
          <StatTile label="Reste à recouvrer" value={fmtXOF(Math.max(0, school.expected - school.collected))} tone={school.expected - school.collected > 0 ? 'warning' : 'success'} />
          <StatTile label="Élèves" value={String(school.totalStudents)} />
        </div>

        <Card padded style={{ marginBottom: 16 }}>
          <CardHeader title="Par classe" />
          <Table columns={classColumns} rows={byClass} rowKey={(c) => c.classe} />
        </Card>

        <Card padded>
          <CardHeader title="Par élève" />
          <Field label="Rechercher">
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Nom ou classe…" />
          </Field>
          <div style={{ marginTop: 10 }}>
            <Table columns={studentColumns} rows={pageRows} rowKey={(r) => r.studentId} onRowClick={openDetail} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>
                {filtered.length} élève(s) · page {Math.min(page + 1, totalPages)} / {totalPages}
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
          </div>
        </Card>
      </StateView>

      <Sheet
        title={selected ? `${selected.nom} · ${selected.classe}` : 'Fiche élève'}
        open={selected != null}
        onClose={closeDetail}
        width="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeDetail}>Fermer</Button>
            <Button
              variant="primary"
              disabled={!isOverdue}
              loading={alertMutation.isPending}
              onClick={() => alertMutation.mutate()}
            >
              Envoyer une alerte de retard
            </Button>
          </>
        }
      >
        <StateView loading={detailQuery.isLoading} error={detailQuery.error} onRetry={() => detailQuery.refetch()}>
          {detailQuery.data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Identité */}
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                <Info label="Nom" value={detailQuery.data.detail.nom} />
                <Info label="Prénom" value={detailQuery.data.detail.prenom} />
                <Info label="Date de naissance" value={detailQuery.data.detail.dateNaissance ?? '—'} />
                <Info label="Classe" value={detailQuery.data.detail.classe} />
                <Info label="Téléphone élève" value={detailQuery.data.detail.telephone ?? '—'} />
              </section>

              {/* Parents */}
              <section>
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 6px' }}>Parent(s) / tuteur(s)</p>
                {detailQuery.data.detail.parents.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Aucun parent rattaché.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {detailQuery.data.detail.parents.map((p) => (
                      <div key={p.id} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '8px 12px', minWidth: 180 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.prenom} {p.nom}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>{p.telephone ?? 'Téléphone non renseigné'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Progression */}
              {progress ? (
                <section style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      Progression · {progress.progressPercentage}%
                    </span>
                    <Badge tone={STATUS_TONE[progress.status] ?? 'neutral'}>{STATUS_LABEL[progress.status] ?? progress.status}</Badge>
                  </div>
                  <Meter value={progress.progressPercentage} tone={rateTone(progress.progressPercentage)} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 10 }}>
                    <Info label="Dû (net bourse)" value={fmtXOF(progress.expectedNetFcfa)} />
                    <Info label="Payé" value={fmtXOF(progress.paidFcfa)} />
                    <Info label="Reste" value={fmtXOF(progress.remainingFcfa)} />
                    {progress.scholarship ? (
                      <Info label="Bourse" value={`${progress.scholarshipPercentage}% (−${fmtXOF(progress.scholarshipCoveredFcfa)})`} />
                    ) : null}
                  </div>
                </section>
              ) : null}

              {/* Paiements détaillés */}
              <section>
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 6px' }}>Paiements détaillés</p>
                {detailQuery.data.history.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Aucun paiement enregistré.</p>
                ) : (
                  <Table columns={paymentColumns} rows={detailQuery.data.history} rowKey={(t) => t.id} />
                )}
              </section>

              {alertMsg ? (
                <p style={{ fontSize: 13, color: alertMutation.isError ? 'var(--color-danger)' : 'var(--color-success, #1f9d55)' }}>
                  {alertMsg}
                </p>
              ) : !isOverdue ? (
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                  L'élève est à jour — aucune alerte de retard à envoyer.
                </p>
              ) : null}
            </div>
          ) : null}
        </StateView>
      </Sheet>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
