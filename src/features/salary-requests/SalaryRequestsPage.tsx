import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, Input, MonthInput, Sheet, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF, monthValueToFR, todayISO } from '@/utils/format';
import type { SalaryMode, SalaryRequest } from '@/types/domain';

const STATUS_TONE = { brouillon: 'info', en_attente: 'warning', validee: 'success', rejetee: 'danger', annulee: 'info' } as const;
const STATUS_LABEL = { brouillon: 'Brouillon', en_attente: 'En attente', validee: 'Validée', rejetee: 'Rejetée', annulee: 'Annulée' } as const;
const SALARY_MODE_LABEL: Record<SalaryMode, string> = { fixe: 'Fixe', par_jour: 'Par jour', par_heure: 'Par heure' };

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
        return {
          teacherId,
          joursTravailles: teacher.salaryMode === 'par_jour' ? worked : undefined,
          heuresTravaillees: teacher.salaryMode === 'par_heure' ? worked : undefined,
        };
      });
      return salaryRequests.create({ periode: monthValueToFR(mois), dateDebut, dateFin, lignes });
    },
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setChecked(new Set());
      setWorkedInputs({});
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
  const validateMutation = useMutation({
    mutationFn: ({ id, approve, comment }: { id: string; approve: boolean; comment?: string }) =>
      salaryRequests.validate(id, approve, comment),
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

  function reject(id: string) {
    const comment = window.prompt('Motif du rejet (visible par la direction) :');
    if (comment === null) return;
    validateMutation.mutate({ id, approve: false, comment });
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
          {r.statut === 'en_attente' ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                loading={validateMutation.isPending}
                onClick={() => validateMutation.mutate({ id: r.id, approve: true })}
              >
                Valider
              </Button>
              <Button variant="danger" size="sm" onClick={() => reject(r.id)}>
                Rejeter
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
        subtitle="Paiement du personnel enseignant — une demande couvre plusieurs enseignants sur une même période."
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
          modes « par jour » et « par heure », indiquez le nombre de jours/heures travaillés sur la période.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
          {activeTeachers.map((t) => {
            const unconfigured = !t.salaryMode;
            return (
              <label
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '8px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  fontSize: 13,
                  opacity: unconfigured ? 0.6 : 1,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    disabled={unconfigured}
                    checked={checked.has(t.id)}
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
