import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, MonthInput, Select, Sheet, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import { fmtXOF, monthValueToFR, todayISO } from '@/utils/format';
import type { SalaryRequest } from '@/types/domain';

const STATUS_TONE = { en_attente: 'warning', validee: 'info', payee: 'success' } as const;
const STATUS_LABEL = { en_attente: 'En attente', validee: 'Validée', payee: 'Payée' } as const;

export default function SalaryRequestsPage() {
  const { salaryRequests, teachers } = useServices();
  const queryClient = useQueryClient();

  const list = useQuery({ queryKey: ['salary-requests'], queryFn: () => salaryRequests.list() });
  const teacherList = useQuery({ queryKey: ['teachers'], queryFn: () => teachers.list() });

  const [singleOpen, setSingleOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [mois, setMois] = useState(todayISO().slice(0, 7));
  const [bulkMois, setBulkMois] = useState(todayISO().slice(0, 7));
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const activeTeachers = (teacherList.data ?? []).filter((t) => t.statut === 'actif');

  const createMutation = useMutation({
    mutationFn: () => salaryRequests.create(teacherId, monthValueToFR(mois)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-requests'] });
      setSingleOpen(false);
      setTeacherId('');
    },
  });

  const bulkMutation = useMutation({
    mutationFn: () => salaryRequests.createBulk([...checked], monthValueToFR(bulkMois)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-requests'] });
      setBulkOpen(false);
      setChecked(new Set());
    },
  });

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openBulk() {
    setChecked(new Set(activeTeachers.map((t) => t.id)));
    setBulkOpen(true);
  }

  const columns: Column<SalaryRequest>[] = [
    { key: 'enseignant', header: 'Enseignant', render: (r) => r.teacherNom },
    { key: 'mois', header: 'Mois', render: (r) => r.mois },
    { key: 'montant', header: 'Montant', render: (r) => fmtXOF(r.montant), align: 'right' },
    { key: 'date', header: 'Créée le', render: (r) => r.dateCreation },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.statut]}>{STATUS_LABEL[r.statut]}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Demandes de salaire"
        subtitle="Suivi des demandes de paiement du personnel enseignant."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button id="btn-bulk-salary" variant="secondary" onClick={openBulk}>
              👥 Demande groupée
            </Button>
            <Button variant="primary" onClick={() => setSingleOpen(true)}>
              + Nouvelle demande
            </Button>
          </div>
        }
      />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(r) => r.id} />
        </StateView>
      </Card>

      <Sheet
        title="Nouvelle demande de paiement"
        open={singleOpen}
        onClose={() => setSingleOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSingleOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" disabled={!teacherId} loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              Envoyer la demande
            </Button>
          </>
        }
      >
        <Field label="Enseignant" required>
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">— Choisir un enseignant —</option>
            {activeTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom} — {fmtXOF(t.salaire)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mois" required>
          <MonthInput value={mois} onChange={(e) => setMois(e.target.value)} />
        </Field>
      </Sheet>

      <Sheet
        title="Demande groupée de paiement"
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        width="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>
              Annuler
            </Button>
            <Button
              id="sb-save"
              variant="primary"
              disabled={checked.size === 0}
              loading={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate()}
            >
              Envoyer {checked.size} demande(s)
            </Button>
          </>
        }
      >
        <Field label="Mois" required>
          <MonthInput id="sb-mois" value={bulkMois} onChange={(e) => setBulkMois(e.target.value)} />
        </Field>
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '4px 0 10px' }}>
          Une demande de paiement sera créée pour chaque personne cochée, au montant de son salaire mensuel.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          {activeTeachers.map((t) => (
            <label
              key={t.id}
              className="sb-pick"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)} />
                {t.nom}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>{fmtXOF(t.salaire)}</span>
            </label>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
