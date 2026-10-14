import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, Input, MonthInput, Select, Sheet, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { CHANNEL_LABELS } from '@/features/payments/pricing';
import { fmtXOF, monthValueToFR, todayISO } from '@/utils/format';
import type { PaymentChannel, PayoutStatus, SalaryMode, SalaryRequest } from '@/types/domain';

const STATUS_TONE = { brouillon: 'info', en_attente: 'warning', validee: 'success', rejetee: 'danger', annulee: 'info' } as const;
const STATUS_LABEL = { brouillon: 'Brouillon', en_attente: 'En attente', validee: 'Validée', rejetee: 'Rejetée', annulee: 'Annulée' } as const;
const SALARY_MODE_LABEL: Record<SalaryMode, string> = { fixe: 'Fixe', par_jour: 'Par jour', par_heure: 'Par heure' };
const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  en_attente: 'En attente',
  paye: 'Payé',
  echec: 'Échec',
  attente_confirmation_cash: 'Attente confirmation (cash)',
};
const PAYOUT_STATUS_TONE: Record<PayoutStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  en_attente: 'info',
  paye: 'success',
  echec: 'danger',
  attente_confirmation_cash: 'warning',
};
/** Canaux pour lesquels un numéro de destination est requis — voir `buildLine()` côté backend. */
const CHANNELS_NEEDING_DESTINATION: PaymentChannel[] = ['wave', 'orange_money'];

/** Premier/dernier jour du mois sélectionné (dd/mm/yyyy) — la période couverte par la demande. */
function monthBounds(monthValue: string): { dateDebut: string; dateFin: string } {
  const [yStr, mStr] = monthValue.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return { dateDebut: fmt(start), dateFin: fmt(end) };
}

export default function SalaryRequestsPage() {
  const { salaryRequests, teachers } = useServices();
  const queryClient = useQueryClient();

  const list = useQuery({ queryKey: ['salary-requests'], queryFn: () => salaryRequests.list() });
  const teacherList = useQuery({ queryKey: ['teachers'], queryFn: () => teachers.list() });

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<SalaryRequest | null>(null);
  const [mois, setMois] = useState(todayISO().slice(0, 7));
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [workedInputs, setWorkedInputs] = useState<Record<string, string>>({});
  const [paymentMethods, setPaymentMethods] = useState<Record<string, PaymentChannel>>({});
  const [destinations, setDestinations] = useState<Record<string, string>>({});

  const activeTeachers = (teacherList.data ?? []).filter((t) => t.statut === 'actif');

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['salary-requests'] });
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const { dateDebut, dateFin } = monthBounds(mois);
      const lignes = [...checked].map((teacherId) => {
        const teacher = activeTeachers.find((t) => t.id === teacherId)!;
        const worked = Number(workedInputs[teacherId] ?? 0);
        const modePaiement = paymentMethods[teacherId];
        return {
          teacherId,
          joursTravailles: teacher.salaryMode === 'par_jour' ? worked : undefined,
          heuresTravaillees: teacher.salaryMode === 'par_heure' ? worked : undefined,
          modePaiement,
          destinationPaiement: modePaiement && CHANNELS_NEEDING_DESTINATION.includes(modePaiement) ? destinations[teacherId] : undefined,
        };
      });
      return salaryRequests.create({ periode: monthValueToFR(mois), dateDebut, dateFin, lignes });
    },
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setChecked(new Set());
      setWorkedInputs({});
      setPaymentMethods({});
      setDestinations({});
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => salaryRequests.submit(id),
    onSuccess: invalidate,
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => salaryRequests.cancel(id),
    onSuccess: invalidate,
  });

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const columns: Column<SalaryRequest>[] = [
    { key: 'periode', header: 'Période', render: (r) => r.periode },
    { key: 'lignes', header: 'Enseignants', render: (r) => `${r.lignes.length} enseignant${r.lignes.length > 1 ? 's' : ''}` },
    { key: 'montant', header: 'Montant total', render: (r) => fmtXOF(r.montantTotal), align: 'right' },
    { key: 'date', header: 'Créée le', render: (r) => r.dateCreation },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.statut]}>{STATUS_LABEL[r.statut]}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
            Détails
          </Button>
          {r.statut === 'brouillon' ? (
            <>
              <Button variant="secondary" size="sm" loading={submitMutation.isPending} onClick={() => submitMutation.mutate(r.id)}>
                Soumettre
              </Button>
              <Button variant="ghost" size="sm" onClick={() => cancelMutation.mutate(r.id)}>
                Annuler
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Demandes de salaire"
        subtitle="Paiement du personnel enseignant — une demande couvre plusieurs enseignants sur une même période. La validation et l’exécution du versement sont faites par la comptabilité."
        action={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            + Nouvelle demande
          </Button>
        }
      />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(r) => r.id} />
        </StateView>
      </Card>

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
            <Button
              variant="primary"
              disabled={checked.size === 0}
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Créer la demande ({checked.size})
            </Button>
          </>
        }
      >
        <Field label="Période" required>
          <MonthInput value={mois} onChange={(e) => setMois(e.target.value)} />
        </Field>
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '4px 0 10px' }}>
          Le montant de chaque ligne est calculé automatiquement à partir du salaire configuré de l’enseignant — pour les
          modes « par jour » et « par heure », indiquez le nombre de jours/heures travaillés sur la période. Choisissez
          également le moyen de paiement de chaque ligne ; espèces par défaut.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
          {activeTeachers.map((t) => {
            const unconfigured = !t.salaryMode;
            const isChecked = checked.has(t.id);
            const mode = paymentMethods[t.id] ?? 'especes';
            const needsDestination = CHANNELS_NEEDING_DESTINATION.includes(mode);
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '8px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  fontSize: 13,
                  opacity: unconfigured ? 0.6 : 1,
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      disabled={unconfigured}
                      checked={isChecked}
                      onChange={() => toggle(t.id)}
                    />
                    {t.nom}
                    <Badge tone="info">{unconfigured ? 'Non configuré' : SALARY_MODE_LABEL[t.salaryMode!]}</Badge>
                  </span>
                  {unconfigured ? (
                    <span style={{ color: 'var(--color-text-muted)' }}>Configurer depuis la fiche enseignant</span>
                  ) : t.salaryMode === 'fixe' ? (
                    <span style={{ color: 'var(--color-text-muted)' }}>{fmtXOF(t.salaireFixe ?? 0)}</span>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      style={{ width: 100 }}
                      placeholder={t.salaryMode === 'par_jour' ? 'Jours' : 'Heures'}
                      value={workedInputs[t.id] ?? ''}
                      onChange={(e) => setWorkedInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    />
                  )}
                </label>
                {isChecked && !unconfigured ? (
                  <div style={{ display: 'flex', gap: 8, paddingLeft: 24 }}>
                    <Select
                      style={{ flex: needsDestination ? '0 0 160px' : '0 0 220px' }}
                      value={mode}
                      onChange={(e) =>
                        setPaymentMethods((prev) => ({ ...prev, [t.id]: e.target.value as PaymentChannel }))
                      }
                    >
                      {(Object.keys(CHANNEL_LABELS) as PaymentChannel[]).map((channel) => (
                        <option key={channel} value={channel}>
                          {CHANNEL_LABELS[channel]}
                        </option>
                      ))}
                    </Select>
                    {needsDestination ? (
                      <Input
                        placeholder="Numéro (par défaut : celui du personnel)"
                        style={{ flex: 1 }}
                        value={destinations[t.id] ?? ''}
                        onChange={(e) => setDestinations((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Sheet>

      <Sheet title="Détails de la demande" open={detail != null} onClose={() => setDetail(null)} width="lg">
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13 }}>
              <strong>{detail.periode}</strong> · {detail.dateDebut} → {detail.dateFin} ·{' '}
              <Badge tone={STATUS_TONE[detail.statut]}>{STATUS_LABEL[detail.statut]}</Badge>
            </p>
            {detail.statut === 'rejetee' && detail.motifRejet ? (
              <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>Motif du rejet : {detail.motifRejet}</p>
            ) : null}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Enseignant</th>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Mode</th>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Jours/Heures</th>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Absences inj.</th>
                  <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Montant</th>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Payeur</th>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Paiement</th>
                  <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Versement</th>
                </tr>
              </thead>
              <tbody>
                {detail.lignes.map((l) => (
                  <tr key={l.teacherId}>
                    <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>{l.teacherNom}</td>
                    <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>{SALARY_MODE_LABEL[l.salaryMode]}</td>
                    <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>
                      {l.joursTravailles ?? l.heuresTravaillees ?? '—'}
                    </td>
                    <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>{l.joursAbsenceInjustifiee ?? '—'}</td>
                    <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)', textAlign: 'right' }}>
                      {fmtXOF(l.montantCalcule)}
                    </td>
                    <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>{l.payeurEtat ? 'État' : 'École'}</td>
                    <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>
                      {CHANNEL_LABELS[l.modePaiement]}
                      {l.destinationPaiement ? <div style={{ color: 'var(--color-text-muted)', fontSize: 11.5 }}>{l.destinationPaiement}</div> : null}
                    </td>
                    <td style={{ padding: '6px 0', borderTop: '1px solid var(--color-border)' }}>
                      {l.statutVersement ? (
                        <>
                          <Badge tone={PAYOUT_STATUS_TONE[l.statutVersement]}>{PAYOUT_STATUS_LABEL[l.statutVersement]}</Badge>
                          {l.statutVersement === 'echec' && l.motifEchecPaiement ? (
                            <div style={{ color: 'var(--color-danger)', fontSize: 11.5, marginTop: 2 }}>{l.motifEchecPaiement}</div>
                          ) : null}
                          {l.statutVersement === 'paye' && l.referenceTransaction ? (
                            <div style={{ color: 'var(--color-text-muted)', fontSize: 11.5, marginTop: 2 }}>Réf. {l.referenceTransaction}</div>
                          ) : null}
                        </>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
