import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  MonthInput,
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
import { fmtXOF, isoToFR, monthValueToFR } from '@/utils/format';
import type {
  PaymentChannel,
  PayrollStaffMember,
  SalaryRequest,
  SalaryRequestLine,
  SalaryRequestStatus,
} from '@/types/domain';

const STATUS_LABEL: Record<SalaryRequestStatus, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  validee: 'Validée',
  rejetee: 'Rejetée',
  annulee: 'Annulée',
};
const STATUS_TONE: Record<SalaryRequestStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  brouillon: 'info',
  en_attente: 'warning',
  validee: 'success',
  rejetee: 'danger',
  annulee: 'info',
};
const TABS: { value: SalaryRequestStatus | 'tous'; label: string }[] = [
  { value: 'tous', label: 'Toutes' },
  { value: 'brouillon', label: 'Brouillons' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'validee', label: 'Validées' },
  { value: 'rejetee', label: 'Rejetées' },
  { value: 'annulee', label: 'Annulées' },
];

const CHANNEL_LABEL: Record<PaymentChannel, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  especes: 'Espèces',
  cheque: 'Chèque',
  virement_bancaire: 'Virement bancaire',
};
const PAYOUT_LABEL: Record<NonNullable<SalaryRequestLine['statutVersement']>, string> = {
  en_attente: 'À régler',
  paye: 'Payé',
  echec: 'Échec',
  attente_confirmation_cash: 'Attente confirmation (cash)',
};
const PAYOUT_TONE: Record<NonNullable<SalaryRequestLine['statutVersement']>, 'info' | 'warning' | 'success' | 'danger'> = {
  en_attente: 'info',
  paye: 'success',
  echec: 'danger',
  attente_confirmation_cash: 'warning',
};

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-10" → dernier jour du mois, format ISO (yyyy-MM-dd). */
function lastDayOfMonthISO(monthValue: string): string {
  const [y, m] = monthValue.split('-').map(Number) as [number, number];
  const last = new Date(y, m, 0).getDate();
  return `${monthValue}-${String(last).padStart(2, '0')}`;
}

interface LineDraft {
  selected: boolean;
  joursTravailles: string;
  heuresTravaillees: string;
  modePaiement: PaymentChannel;
  destinationPaiement: string;
}

function defaultDraft(staff: PayrollStaffMember): LineDraft {
  return {
    selected: false,
    joursTravailles: '',
    heuresTravaillees: '',
    modePaiement: 'especes',
    destinationPaiement: staff.tel ?? '',
  };
}

export default function SalaryPaymentsPage() {
  const { salaryPayments, ledger } = useServices();
  const queryClient = useQueryClient();

  const [view, setView] = useState<'demandes' | 'bulletins'>('demandes');
  const [tab, setTab] = useState<SalaryRequestStatus | 'tous'>('tous');

  const [createOpen, setCreateOpen] = useState(false);
  const [periodMonth, setPeriodMonth] = useState(currentMonthValue());
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [createError, setCreateError] = useState<string | null>(null);

  const [detail, setDetail] = useState<SalaryRequest | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [settleIds, setSettleIds] = useState<Set<string>>(new Set());
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const [payslipStaffId, setPayslipStaffId] = useState<string>('');

  const list = useQuery({ queryKey: ['salary-requests'], queryFn: () => salaryPayments.list() });
  const staff = useQuery({ queryKey: ['payroll-staff'], queryFn: () => salaryPayments.listPayableStaff() });
  const ledgerQuery = useQuery({ queryKey: ['ledger'], queryFn: () => ledger.get() });
  const payslips = useQuery({
    queryKey: ['payslips', payslipStaffId],
    queryFn: () => salaryPayments.listPayslips(payslipStaffId),
    enabled: view === 'bulletins' && payslipStaffId !== '',
  });

  const filtered = useMemo(() => {
    const rows = list.data ?? [];
    return tab === 'tous' ? rows : rows.filter((r) => r.statut === tab);
  }, [list.data, tab]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['salary-requests'] });
    queryClient.invalidateQueries({ queryKey: ['ledger'] });
  }

  function draftFor(s: PayrollStaffMember): LineDraft {
    return drafts[s.id] ?? defaultDraft(s);
  }
  function patchDraft(staffId: string, staffList: PayrollStaffMember[], patch: Partial<LineDraft>) {
    const s = staffList.find((x) => x.id === staffId);
    setDrafts((prev) => {
      const base = prev[staffId] ?? (s ? defaultDraft(s) : undefined);
      if (!base) return prev;
      const merged: LineDraft = {
        selected: patch.selected ?? base.selected,
        joursTravailles: patch.joursTravailles ?? base.joursTravailles,
        heuresTravaillees: patch.heuresTravaillees ?? base.heuresTravaillees,
        modePaiement: patch.modePaiement ?? base.modePaiement,
        destinationPaiement: patch.destinationPaiement ?? base.destinationPaiement,
      };
      return { ...prev, [staffId]: merged };
    });
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const selected = (staff.data ?? []).filter((s) => draftFor(s).selected);
      const periodStartISO = `${periodMonth}-01`;
      const periodEndISO = lastDayOfMonthISO(periodMonth);
      return salaryPayments.create({
        periode: monthValueToFR(periodMonth),
        dateDebut: isoToFR(periodStartISO),
        dateFin: isoToFR(periodEndISO),
        lignes: selected.map((s) => {
          const d = draftFor(s);
          const isWaveOrOm = d.modePaiement === 'wave' || d.modePaiement === 'orange_money';
          return {
            staffUserId: s.id,
            joursTravailles: s.salaryMode === 'par_jour' ? Number(d.joursTravailles) : undefined,
            heuresTravaillees: s.salaryMode === 'par_heure' ? Number(d.heuresTravaillees) : undefined,
            modePaiement: d.modePaiement,
            destinationPaiement: isWaveOrOm ? d.destinationPaiement || undefined : undefined,
          };
        }),
      });
    },
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setDrafts({});
      setCreateError(null);
    },
    onError: (err: unknown) => setCreateError(err instanceof AppError ? err.message : 'Création impossible.'),
  });

  function submitCreate() {
    setCreateError(null);
    const selected = (staff.data ?? []).filter((s) => draftFor(s).selected);
    if (selected.length === 0) {
      setCreateError('Choisissez au moins un membre du personnel.');
      return;
    }
    for (const s of selected) {
      const d = draftFor(s);
      if (s.salaryMode === null) {
        setCreateError(`Aucun salaire configuré pour ${s.nom} — configurez-le depuis la fiche enseignant avant de continuer.`);
        return;
      }
      if (s.salaryMode === 'par_jour' && !d.joursTravailles) {
        setCreateError(`Jours travaillés requis pour ${s.nom}.`);
        return;
      }
      if (s.salaryMode === 'par_heure' && !d.heuresTravaillees) {
        setCreateError(`Heures travaillées requises pour ${s.nom}.`);
        return;
      }
    }
    createMutation.mutate();
  }

  function openDetail(r: SalaryRequest) {
    setDetail(r);
    setDecisionComment('');
    setDecisionError(null);
    setSettleIds(new Set(r.lignes.map((l) => l.teacherId)));
  }

  const submitMutation = useMutation({
    mutationFn: (id: string) => salaryPayments.submit(id),
    onSuccess: (updated) => {
      invalidate();
      setDetail(updated);
    },
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => salaryPayments.cancel(id),
    onSuccess: (updated) => {
      invalidate();
      setDetail(updated);
    },
  });
  const decideMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approuve' | 'rejete' }) =>
      salaryPayments.validate(id, decision, {
        comment: decisionComment || undefined,
        selectedStaffUserIds: decision === 'approuve' ? Array.from(settleIds) : undefined,
      }),
    onSuccess: (updated) => {
      invalidate();
      setDetail(updated);
      setDecisionComment('');
      setDecisionError(null);
    },
    onError: (err: unknown) =>
      setDecisionError(err instanceof AppError ? err.message : 'Décision impossible.'),
  });

  const requestColumns: Column<SalaryRequest>[] = [
    { key: 'periode', header: 'Période', render: (r) => r.periode },
    { key: 'lignes', header: 'Personnel', render: (r) => `${r.lignes.length} ligne(s)` },
    { key: 'total', header: 'Montant total', align: 'right', render: (r) => fmtXOF(r.montantTotal) },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.statut]}>{STATUS_LABEL[r.statut]}</Badge> },
    { key: 'date', header: 'Créée le', render: (r) => r.dateCreation },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={() => openDetail(r)}>
          Détails
        </Button>
      ),
    },
  ];

  const lineColumns: Column<SalaryRequestLine>[] = [
    { key: 'nom', header: 'Personnel', render: (l) => l.teacherNom },
    { key: 'montant', header: 'Montant', align: 'right', render: (l) => fmtXOF(l.montantCalcule) },
    { key: 'payeur', header: 'Payeur', render: (l) => (l.payeurEtat ? 'État' : 'École') },
    { key: 'mode', header: 'Mode', render: (l) => CHANNEL_LABEL[l.modePaiement] },
    {
      key: 'versement',
      header: 'Versement',
      render: (l) =>
        l.statutVersement ? (
          <Badge tone={PAYOUT_TONE[l.statutVersement]}>{PAYOUT_LABEL[l.statutVersement]}</Badge>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Salaires"
        subtitle="Demandes de paiement de salaire et bulletins — une demande couvre plusieurs membres du personnel enseignant sur une même période."
        action={
          view === 'demandes' ? (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              + Nouvelle demande
            </Button>
          ) : undefined
        }
      />

      <Segmented
        value={view}
        onChange={(v) => setView(v as 'demandes' | 'bulletins')}
        options={[
          { value: 'demandes', label: 'Demandes' },
          { value: 'bulletins', label: 'Bulletins de paie' },
        ]}
      />

      {view === 'demandes' ? (
        <>
          <div style={{ marginTop: 12 }}>
            <Segmented value={tab} onChange={(v) => setTab(v as SalaryRequestStatus | 'tous')} options={TABS} />
          </div>

          <Card style={{ marginTop: 12 }}>
            <StateView loading={list.isLoading} error={list.error} empty={filtered.length === 0} onRetry={() => list.refetch()}>
              <Table columns={requestColumns} rows={filtered} rowKey={(r) => r.id} />
            </StateView>
          </Card>
        </>
      ) : (
        <Card padded style={{ marginTop: 12 }}>
          <Field label="Personnel">
            <Select value={payslipStaffId} onChange={(e) => setPayslipStaffId(e.target.value)}>
              <option value="">Choisir…</option>
              {(staff.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </Select>
          </Field>

          {payslipStaffId ? (
            <StateView
              loading={payslips.isLoading}
              error={payslips.error}
              empty={(payslips.data ?? []).length === 0}
              emptyLabel="Aucun bulletin pour ce personnel."
              onRetry={() => payslips.refetch()}
            >
              <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(payslips.data ?? []).map((p) => (
                  <li key={p.id}>
                    <strong>{p.periode}</strong> — {fmtXOF(p.montantBrut)} ({p.payeurEtat ? 'payé par l’État' : 'payé par l’école'}),
                    généré le {p.dateGeneration}
                  </li>
                ))}
              </ul>
            </StateView>
          ) : null}
        </Card>
      )}

      {/* ── Création ─────────────────────────────────────────────────── */}
      <Sheet
        title="Nouvelle demande de paiement"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        width="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" loading={createMutation.isPending} onClick={submitCreate}>
              Créer la demande
            </Button>
          </>
        }
      >
        <Field label="Période" required>
          <MonthInput value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
        </Field>

        <StateView loading={staff.isLoading} error={staff.error} empty={(staff.data ?? []).length === 0} emptyLabel="Aucun enseignant dans cet établissement.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {(staff.data ?? []).map((s) => {
              const d = draftFor(s);
              const notConfigured = s.salaryMode === null;
              return (
                <div
                  key={s.id}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 10,
                    padding: 10,
                    opacity: notConfigured ? 0.6 : 1,
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={d.selected}
                      disabled={notConfigured}
                      onChange={(e) => patchDraft(s.id, staff.data ?? [], { selected: e.target.checked })}
                    />
                    <strong>{s.nom}</strong>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {notConfigured
                        ? '— salaire non configuré'
                        : s.salaryMode === 'fixe'
                          ? `— fixe : ${fmtXOF(s.salaireFixe ?? 0)}`
                          : s.salaryMode === 'par_jour'
                            ? `— ${fmtXOF(s.tauxJournalier ?? 0)}/jour`
                            : `— ${fmtXOF(s.tauxHoraire ?? 0)}/heure`}
                    </span>
                  </label>

                  {d.selected ? (
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                      {s.salaryMode === 'par_jour' ? (
                        <Field label="Jours travaillés" required>
                          <Input
                            type="number"
                            min={0}
                            value={d.joursTravailles}
                            onChange={(e) => patchDraft(s.id, staff.data ?? [], { joursTravailles: e.target.value })}
                          />
                        </Field>
                      ) : null}
                      {s.salaryMode === 'par_heure' ? (
                        <Field label="Heures travaillées" required>
                          <Input
                            type="number"
                            min={0}
                            value={d.heuresTravaillees}
                            onChange={(e) => patchDraft(s.id, staff.data ?? [], { heuresTravaillees: e.target.value })}
                          />
                        </Field>
                      ) : null}
                      <Field label="Mode de règlement">
                        <Select
                          value={d.modePaiement}
                          onChange={(e) =>
                            patchDraft(s.id, staff.data ?? [], { modePaiement: e.target.value as PaymentChannel })
                          }
                        >
                          {(Object.keys(CHANNEL_LABEL) as PaymentChannel[]).map((c) => (
                            <option key={c} value={c}>
                              {CHANNEL_LABEL[c]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      {d.modePaiement === 'wave' || d.modePaiement === 'orange_money' ? (
                        <Field label="Numéro de réception" hint="Celui du personnel par défaut.">
                          <Input
                            value={d.destinationPaiement}
                            onChange={(e) => patchDraft(s.id, staff.data ?? [], { destinationPaiement: e.target.value })}
                          />
                        </Field>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </StateView>

        {createError ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 10 }}>{createError}</p> : null}
      </Sheet>

      {/* ── Détail ───────────────────────────────────────────────────── */}
      <Sheet title="Demande de paiement de salaire" open={detail != null} onClose={() => setDetail(null)} width="lg">
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13 }}>
              <strong>{detail.periode}</strong> ({detail.dateDebut} → {detail.dateFin}) ·{' '}
              <Badge tone={STATUS_TONE[detail.statut]}>{STATUS_LABEL[detail.statut]}</Badge> · Total :{' '}
              <strong>{fmtXOF(detail.montantTotal)}</strong>
            </p>

            <Table columns={lineColumns} rows={detail.lignes} rowKey={(l) => l.teacherId} />

            {detail.splitIntoRequestId ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Reliquat (lignes non réglées, solde insuffisant) déplacé vers la demande brouillon #
                {detail.splitIntoRequestId.slice(-6)}.
              </p>
            ) : null}
            {detail.statut === 'rejetee' && detail.motifRejet ? (
              <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>Motif du rejet : {detail.motifRejet}</p>
            ) : null}

            {detail.statut === 'brouillon' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="primary" size="sm" loading={submitMutation.isPending} onClick={() => submitMutation.mutate(detail.id)}>
                  Soumettre
                </Button>
                <Button variant="ghost" size="sm" loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate(detail.id)}>
                  Annuler la demande
                </Button>
              </div>
            ) : null}

            {detail.statut === 'en_attente' ? (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 10 }}>
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 8px' }}>
                  Solde disponible :{' '}
                  <strong>{ledgerQuery.data ? fmtXOF(ledgerQuery.data.solde) : '…'}</strong> — décochez une ligne pour ne
                  la régler que plus tard (elle part dans une nouvelle demande brouillon).
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {detail.lignes.map((l) => (
                    <label key={l.teacherId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={settleIds.has(l.teacherId)}
                        onChange={(e) =>
                          setSettleIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(l.teacherId);
                            else next.delete(l.teacherId);
                            return next;
                          })
                        }
                      />
                      {l.teacherNom} — {fmtXOF(l.montantCalcule)}
                    </label>
                  ))}
                </div>
                <Field label="Commentaire (obligatoire pour un rejet)">
                  <Textarea value={decisionComment} onChange={(e) => setDecisionComment(e.target.value)} rows={2} />
                </Field>
                {decisionError ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{decisionError}</p> : null}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={settleIds.size === 0}
                    loading={decideMutation.isPending}
                    onClick={() => decideMutation.mutate({ id: detail.id, decision: 'approuve' })}
                  >
                    Approuver ({settleIds.size}/{detail.lignes.length})
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={!decisionComment.trim()}
                    loading={decideMutation.isPending}
                    onClick={() => decideMutation.mutate({ id: detail.id, decision: 'rejete' })}
                  >
                    Rejeter
                  </Button>
                </div>
              </div>
            ) : null}

            {detail.historiqueValidation.length > 0 ? (
              <div>
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 6px' }}>Historique de validation</p>
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
