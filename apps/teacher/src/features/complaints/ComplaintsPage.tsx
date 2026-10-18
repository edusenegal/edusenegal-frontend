import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Field, Input, Select, StateView, Table, Textarea, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { Complaint, ComplaintType } from '@/types/domain';

const TYPE_LABEL: Record<ComplaintType, string> = {
  contre_professeur: 'Contre un collègue',
  contestation_note: 'Contestation de note',
  emploi_du_temps: 'Emploi du temps',
  infrastructure: 'Infrastructure',
  administratif: 'Administratif',
  suggestion: 'Suggestion',
  autre: 'Autre',
};
const STATUS_TONE = { soumise: 'info', en_cours: 'warning', resolue: 'success', rejetee: 'danger', archivee: 'neutral' } as const;
const STATUS_LABEL = { soumise: 'Soumise', en_cours: 'En cours', resolue: 'Résolue', rejetee: 'Rejetée', archivee: 'Archivée' } as const;
const TYPES = Object.keys(TYPE_LABEL) as ComplaintType[];

export default function ComplaintsPage() {
  const { complaints } = useServices();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['complaints', 'mine'], queryFn: () => complaints.mine() });

  const [type, setType] = useState<ComplaintType>('autre');
  const [sujet, setSujet] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => complaints.create({ type, sujet: sujet.trim(), description: description.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints', 'mine'] });
      setSujet('');
      setDescription('');
      setType('autre');
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Échec de l’envoi.'),
  });

  function onSubmit() {
    if (!sujet.trim() || !description.trim()) {
      setError('Le sujet et la description sont obligatoires.');
      return;
    }
    createMutation.mutate();
  }

  const columns: Column<Complaint>[] = [
    { key: 'type', header: 'Type', render: (c) => TYPE_LABEL[c.type] },
    { key: 'sujet', header: 'Sujet', render: (c) => c.sujet },
    { key: 'statut', header: 'Statut', render: (c) => <Badge tone={STATUS_TONE[c.statut]}>{STATUS_LABEL[c.statut]}</Badge> },
    { key: 'resolution', header: 'Réponse', render: (c) => c.resolution ?? '—' },
    { key: 'date', header: 'Envoyée le', render: (c) => c.creeLe },
  ];

  return (
    <div>
      <PageHeader title="Réclamations & suggestions" subtitle="Signalez un problème ou proposez une amélioration à la direction." />

      <Card padded style={{ marginBottom: 16 }}>
        <CardHeader title="Nouvelle réclamation" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as ComplaintType)} style={{ width: 200 }}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sujet" required>
            <Input value={sujet} onChange={(e) => setSujet(e.target.value)} style={{ width: 220 }} />
          </Field>
          <Field label="Description" required>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: 300 }} />
          </Field>
          <Button variant="primary" size="sm" loading={createMutation.isPending} onClick={onSubmit}>
            Envoyer
          </Button>
        </div>
        {error ? <p style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>{error}</p> : null}
      </Card>

      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(c) => c.id} />
        </StateView>
      </Card>
    </div>
  );
}
