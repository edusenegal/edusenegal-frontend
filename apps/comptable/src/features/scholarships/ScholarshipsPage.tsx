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
import { fmtXOF, isoToFR, todayISO } from '@/utils/format';
import type { PaymentChannel, Scholarship, ScholarshipSlice, ScholarshipSliceStatus, ScholarshipStatus, StudentPickerEntry } from '@/types/domain';

const STATUS_LABEL: Record<ScholarshipStatus, string> = {
  en_attente_validation: 'En attente de validation',
  validee: 'Validée',
  rejetee: 'Rejetée',
  active: 'Active',
  suspendue: 'Suspendue',
  terminee: 'Terminée',
};
const STATUS_TONE: Record<ScholarshipStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  en_attente_validation: 'warning',
  validee: 'info',
  rejetee: 'danger',
  active: 'success',
  suspendue: 'warning',
  terminee: 'info',
};

const SLICE_STATUS_LABEL: Record<ScholarshipSliceStatus, string> = {
  attendue: 'Attendue',
  payee: 'Payée',
  en_retard: 'En retard',
  partielle: 'Partielle',
  en_cours: 'En cours',
};
const SLICE_STATUS_TONE: Record<ScholarshipSliceStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  attendue: 'info',
  payee: 'success',
  en_retard: 'danger',
  partielle: 'warning',
  en_cours: 'warning',
};

const CHANNEL_OPTIONS: { value: PaymentChannel; label: string }[] = [
  { value: 'virement_bancaire', label: 'Virement bancaire' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'especes', label: 'Espèces' },
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'Orange Money' },
];

export default function ScholarshipsPage() {
  const { students, scholarships } = useServices();
  const queryClient = useQueryClient();

  const [view, setView] = useState<'ecole' | 'payeur'>('ecole');
  const [payerQuery, setPayerQuery] = useState('');
  const [detail, setDetail] = useState<Scholarship | null>(null);
  const [editingSliceId, setEditingSliceId] = useState<string | null>(null);

  const studentsList = useQuery({ queryKey: ['students-all'], queryFn: () => students.listAll() });
  const studentById = useMemo(() => {
    const map = new Map<string, StudentPickerEntry>();
    for (const s of studentsList.data ?? []) map.set(s.id, s);
    return map;
  }, [studentsList.data]);

  const schoolList = useQuery({
    queryKey: ['scholarships', 'school'],
    queryFn: () => scholarships.listBySchool(),
    enabled: view === 'ecole',
  });
  const payerList = useQuery({
    queryKey: ['scholarships', 'payer', payerQuery],
    queryFn: () => scholarships.listByPayer(payerQuery),
    enabled: view === 'payeur' && payerQuery.trim().length >= 2,
  });

  const rows = view === 'ecole' ? schoolList.data ?? [] : payerList.data ?? [];
  const activeQuery = view === 'ecole' ? schoolList : payerList;

  function invalidateLists() {
    queryClient.invalidateQueries({ queryKey: ['scholarships'] });
  }

  const studentLabel = (studentId: string) => {
    const s = studentById.get(studentId);
    return s ? `${s.nom} (${s.classe})` : `#${studentId.slice(-6)}`;
  };

  const columns: Column<Scholarship>[] = [
    { key: 'eleve', header: 'Élève', render: (r) => studentLabel(r.studentId) },
    { key: 'payeur', header: 'Structure payeuse', render: (r) => `${r.payeurNom} (${r.payeurType})` },
    { key: 'pourcentage', header: '% couvert', align: 'right', render: (r) => `${r.pourcentageCouvert}%` },
    { key: 'couvert', header: 'Montant couvert', align: 'right', render: (r) => fmtXOF(r.montantCouvertFcfa) },
    {
      key: 'progression',
      header: 'Versé par le payeur',
      align: 'right',
      render: (r) => `${fmtXOF(r.totalPayeParPayeurFcfa)} (${r.progressionPayeurPercent}%)`,
    },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.statut]}>{STATUS_LABEL[r.statut]}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Button variant="secondary" size="sm" onClick={() => setDetail(r)}>
          Détails
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bourses"
        subtitle="Suivi des dossiers de bourse et des versements reçus des structures payeuses — création, validation et activation du dossier restent gérées par la direction."
      />

      <Segmented
        options={[
          { value: 'ecole', label: 'Vue école' },
          { value: 'payeur', label: 'Par structure payeuse' },
        ]}
        value={view}
        onChange={(v) => setView(v as 'ecole' | 'payeur')}
      />

      {view === 'payeur' ? (
        <Card padded style={{ marginTop: 12 }}>
          <Field label="Nom de la structure payeuse" hint='Ex: "Total", "Sama Bourse", "État"...'>
            <Input value={payerQuery} onChange={(e) => setPayerQuery(e.target.value)} />
          </Field>
        </Card>
      ) : null}

      {view === 'ecole' || payerQuery.trim().length >= 2 ? (
        <Card style={{ marginTop: 12 }}>
          <StateView
            loading={activeQuery.isLoading || studentsList.isLoading}
            error={activeQuery.error}
            empty={rows.length === 0}
            emptyLabel="Aucun dossier de bourse."
            onRetry={() => activeQuery.refetch()}
          >
            <Table columns={columns} rows={rows} rowKey={(r) => r.id} />
          </StateView>
        </Card>
      ) : (
        <Card padded style={{ marginTop: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            Saisissez au moins 2 caractères du nom de la structure payeuse.
          </p>
        </Card>
      )}

      <Sheet
        title={detail ? `Bourse — ${studentLabel(detail.studentId)}` : 'Bourse'}
        open={detail != null}
        onClose={() => {
          setDetail(null);
          setEditingSliceId(null);
        }}
        width="lg"
      >
        {detail ? (
          <ScholarshipDetail
            scholarship={detail}
            editingSliceId={editingSliceId}
            onEditSlice={setEditingSliceId}
            onRecorded={(updated) => {
              setDetail(updated);
              setEditingSliceId(null);
              invalidateLists();
            }}
          />
        ) : null}
      </Sheet>
    </div>
  );
}

function ScholarshipDetail({
  scholarship,
  editingSliceId,
  onEditSlice,
  onRecorded,
}: {
  scholarship: Scholarship;
  editingSliceId: string | null;
  onEditSlice(sliceId: string | null): void;
  onRecorded(updated: Scholarship): void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, fontSize: 13.5 }}>
        <div>
          <strong>Structure payeuse :</strong> {scholarship.payeurNom} ({scholarship.payeurType})
        </div>
        <div>
          <strong>Couverture :</strong> {scholarship.pourcentageCouvert}%
        </div>
        <div>
          <strong>Montant annuel total :</strong> {fmtXOF(scholarship.montantAnnuelTotalFcfa)}
        </div>
        <div>
          <strong>Montant couvert :</strong> {fmtXOF(scholarship.montantCouvertFcfa)}
        </div>
        <div>
          <strong>Reste à charge élève :</strong> {fmtXOF(scholarship.resteEleveFcfa)}
        </div>
        <div>
          <strong>Statut :</strong> <Badge tone={STATUS_TONE[scholarship.statut]}>{STATUS_LABEL[scholarship.statut]}</Badge>
        </div>
      </div>

      {scholarship.motifRejet ? (
        <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>Motif de rejet : « {scholarship.motifRejet} »</p>
      ) : null}

      <div>
        <CardHeader title="Tranches de paiement (structure payeuse)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {scholarship.tranches.map((slice) => (
            <SliceRow
              key={slice.id}
              scholarshipId={scholarship.id}
              slice={slice}
              scholarshipTerminee={scholarship.statut === 'terminee'}
              editing={editingSliceId === slice.id}
              onToggleEdit={() => onEditSlice(editingSliceId === slice.id ? null : slice.id)}
              onRecorded={onRecorded}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SliceRow({
  scholarshipId,
  slice,
  scholarshipTerminee,
  editing,
  onToggleEdit,
  onRecorded,
}: {
  scholarshipId: string;
  slice: ScholarshipSlice;
  scholarshipTerminee: boolean;
  editing: boolean;
  onToggleEdit(): void;
  onRecorded(updated: Scholarship): void;
}) {
  const { scholarships } = useServices();

  const [paidFcfa, setPaidFcfa] = useState('');
  const [paidDate, setPaidDate] = useState(todayISO());
  const [channel, setChannel] = useState<PaymentChannel>('virement_bancaire');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      scholarships.recordSlicePayment(scholarshipId, {
        sliceId: slice.id,
        paidFcfa: Number(paidFcfa),
        paidDate: isoToFR(paidDate),
        channel,
        note: note.trim() || undefined,
        paymentProof: proof ?? undefined,
      }),
    onSuccess: (updated) => {
      setPaidFcfa('');
      setNote('');
      setProof(null);
      setError(null);
      onRecorded(updated);
    },
    onError: (err: unknown) => {
      setError(err instanceof AppError ? err.message : 'Enregistrement impossible.');
    },
  });

  const canRecord = slice.statut !== 'payee' && !scholarshipTerminee;

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 13.5 }}>
          Échéance {slice.dateEcheance} — attendu {fmtXOF(slice.montantAttenduFcfa)}, reçu {fmtXOF(slice.montantPayeFcfa)}
          {slice.dernierVersementLe ? ` (dernier versement le ${slice.dernierVersementLe})` : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge tone={SLICE_STATUS_TONE[slice.statut]}>{SLICE_STATUS_LABEL[slice.statut]}</Badge>
          {canRecord ? (
            <Button variant="secondary" size="sm" onClick={onToggleEdit}>
              {editing ? 'Annuler' : 'Enregistrer un versement'}
            </Button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
          <Field label="Montant reçu (FCFA)" required>
            <Input type="number" min={0} value={paidFcfa} onChange={(e) => setPaidFcfa(e.target.value)} />
          </Field>
          <Field label="Date de versement" required>
            <DateInput value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </Field>
          <Field label="Canal" required>
            <Select value={channel} onChange={(e) => setChannel(e.target.value as PaymentChannel)}>
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Justificatif" hint="Facultatif — facture, reçu bancaire...">
            <input type="file" onChange={(e) => setProof(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5 }} />
          </Field>
          <Field label="Note" hint="Facultatif.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>
          {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
          <Button variant="primary" loading={mutation.isPending} disabled={!paidFcfa} onClick={() => mutation.mutate()}>
            Valider le versement
          </Button>
        </div>
      ) : null}
    </div>
  );
}
