import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, Field, Select, Sheet, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { TransferRequest } from '@/types/domain';

const STATUS_TONE = { en_attente: 'warning', acceptee: 'success', refusee: 'danger' } as const;
const STATUS_LABEL = { en_attente: 'En attente', acceptee: 'Acceptée', refusee: 'Refusée' } as const;

const REGIONS = ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor'];
const SCHOOLS_BY_REGION: Record<string, string[]> = {
  Dakar: ['Lycée John F. Kennedy', 'Lycée Blaise Diagne', 'Lycée Seydina Limamoulaye'],
  Thiès: ['Lycée Malick Sy', 'Lycée El Hadji Omar Lamine Badiane'],
  'Saint-Louis': ['Lycée Charles de Gaulle', 'Lycée El Hadji Amadou Malick Gaye'],
  Ziguinchor: ['Lycée Djignabo'],
};

export default function TransfersPage() {
  const { transfers, students, classes } = useServices();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'interne' | 'externe'>('interne');
  const [studentId, setStudentId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [region, setRegion] = useState(REGIONS[0]!);
  const [schoolName, setSchoolName] = useState(SCHOOLS_BY_REGION[REGIONS[0]!]![0]!);
  const [error, setError] = useState<string | null>(null);

  // Arrivée depuis la fiche d'un élève (bouton « Transférer ») : préremplit
  // et ouvre directement le formulaire avec cet élève sélectionné.
  useEffect(() => {
    const preselected = (location.state as { studentId?: string } | null)?.studentId;
    if (preselected) {
      setStudentId(preselected);
      setModalOpen(true);
    }
  }, [location.key]);

  const list = useQuery({ queryKey: ['transfers'], queryFn: () => transfers.list() });
  const studentList = useQuery({ queryKey: ['students'], queryFn: () => students.list() });
  const classList = useQuery({ queryKey: ['classes'], queryFn: () => classes.list() });

  const schoolsOfRegion = useMemo(() => [...(SCHOOLS_BY_REGION[region] ?? [])].sort((a, b) => a.localeCompare(b)), [region]);

  const internalMutation = useMutation({
    mutationFn: () => transfers.requestInternal(studentId, targetClassId),
    onSuccess: closeAndRefresh,
  });
  const externalMutation = useMutation({
    mutationFn: () => transfers.requestExternal(studentId, region, schoolName),
    onSuccess: closeAndRefresh,
  });

  function closeAndRefresh() {
    queryClient.invalidateQueries({ queryKey: ['transfers'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    setModalOpen(false);
    setStudentId('');
    setTargetClassId('');
    setError(null);
  }

  function onSubmit() {
    if (!studentId) {
      setError('Choisissez un élève.');
      return;
    }
    if (mode === 'interne') {
      if (!targetClassId) {
        setError('Choisissez la classe de destination.');
        return;
      }
      internalMutation.mutate();
    } else {
      externalMutation.mutate();
    }
  }

  const columns: Column<TransferRequest>[] = [
    { key: 'eleve', header: 'Élève', render: (r) => r.studentNom },
    { key: 'mode', header: 'Type', render: (r) => (r.mode === 'interne' ? 'Interne' : 'Externe') },
    {
      key: 'destination',
      header: 'Destination',
      render: (r) =>
        r.mode === 'interne'
          ? classList.data?.find((c) => c.id === r.classeArriveeId)?.name ?? '—'
          : `${r.ecoleDestination} (${r.regionDestination})`,
    },
    { key: 'date', header: 'Date', render: (r) => r.date },
    { key: 'statut', header: 'Statut', render: (r) => <Badge tone={STATUS_TONE[r.statut]}>{STATUS_LABEL[r.statut]}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Transferts"
        subtitle="Transférer un élève vers une autre classe de l’établissement, ou vers une autre école."
        action={
          <Button id="btn-new-transfer" variant="primary" onClick={() => setModalOpen(true)}>
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
        title="Nouvelle demande de transfert"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        width="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button
              id="t-send-ext"
              variant="primary"
              loading={internalMutation.isPending || externalMutation.isPending}
              onClick={onSubmit}
            >
              Envoyer la demande
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Button
            type="button"
            variant={mode === 'interne' ? 'primary' : 'secondary'}
            size="sm"
            data-tmode="interne"
            onClick={() => setMode('interne')}
          >
            Vers une classe de l’établissement
          </Button>
          <Button
            type="button"
            variant={mode === 'externe' ? 'primary' : 'secondary'}
            size="sm"
            data-tmode="externe"
            onClick={() => setMode('externe')}
          >
            Vers une autre école
          </Button>
        </div>

        <Field label="Élève" required>
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">— Choisir un élève —</option>
            {studentList.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.prenom} {s.nom} — {s.classe}
              </option>
            ))}
          </Select>
        </Field>

        {mode === 'interne' ? (
          <Field label="Classe de destination" required>
            <Select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
              <option value="">— Choisir une classe —</option>
              {classList.data
                ?.filter((c) => c.id !== studentList.data?.find((s) => s.id === studentId)?.classeId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
        ) : (
          <>
            <Field label="Région">
              <Select
                id="t-region"
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setSchoolName(SCHOOLS_BY_REGION[e.target.value]?.[0] ?? '');
                }}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="École de destination">
              <Select id="t-school" value={schoolName} onChange={(e) => setSchoolName(e.target.value)}>
                {schoolsOfRegion.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <div id="t-school-details" style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13, color: 'var(--color-text-muted)' }}>
              Cette demande sera enregistrée comme une demande de transfert externe. Ce prototype ne communique pas avec le
              système de l’école de destination — la suite du transfert se fait hors application.
            </div>
          </>
        )}

        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p> : null}
      </Sheet>
    </div>
  );
}
