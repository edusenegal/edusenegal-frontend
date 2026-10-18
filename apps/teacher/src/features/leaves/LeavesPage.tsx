import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Input, StateView, Table, Textarea, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { LeaveRequest } from '@/types/domain';

const STATUS_TONE = { en_attente: 'warning', approuve: 'success', rejete: 'danger' } as const;
const STATUS_LABEL = { en_attente: 'En attente', approuve: 'Approuvé', rejete: 'Rejeté' } as const;

export default function LeavesPage() {
  const { leaves } = useServices();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['leaves', 'mine'], queryFn: () => leaves.mine() });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [motif, setMotif] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestMutation = useMutation({
    mutationFn: () => leaves.request({ dateDebut, dateFin, motif: motif.trim(), pieceJointe: file ?? undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', 'mine'] });
      setDateDebut('');
      setDateFin('');
      setMotif('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Échec de la demande.'),
  });

  function onSubmit() {
    if (!dateDebut || !dateFin || !motif.trim()) {
      setError('Les dates et le motif sont obligatoires.');
      return;
    }
    requestMutation.mutate();
  }

  const columns: Column<LeaveRequest>[] = [
    { key: 'periode', header: 'Période', render: (l) => `${l.dateDebut} → ${l.dateFin}` },
    { key: 'motif', header: 'Motif', render: (l) => l.motif },
    { key: 'remplacant', header: 'Remplaçant', render: (l) => l.remplacant ?? '—' },
    { key: 'statut', header: 'Statut', render: (l) => <Badge tone={STATUS_TONE[l.statut]}>{STATUS_LABEL[l.statut]}</Badge> },
    { key: 'motifRefus', header: 'Motif du refus', render: (l) => l.motifRefus ?? '—' },
  ];

  return (
    <div>
      <PageHeader title="Congés" subtitle="Vos demandes de congé et leur statut." />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Nouvelle demande" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Début" required>
            <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </Field>
          <Field label="Fin" required>
            <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </Field>
          <Field label="Motif" required>
            <Textarea rows={1} value={motif} onChange={(e) => setMotif(e.target.value)} style={{ width: 260 }} />
          </Field>
          <Field label="Pièce jointe">
            <input ref={fileInputRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5 }} />
          </Field>
          <Button variant="primary" size="sm" loading={requestMutation.isPending} onClick={onSubmit}>
            Envoyer la demande
          </Button>
        </div>
        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{error}</p> : null}
      </Card>

      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(l) => l.id} />
        </StateView>
      </Card>
    </div>
  );
}
