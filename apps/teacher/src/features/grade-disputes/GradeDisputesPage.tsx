import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Field, Input, StateView, Table, type Column } from '@/components/ui';
import { useServices } from '@/hooks/useServices';
import type { GradeDispute } from '@/types/domain';

export default function GradeDisputesPage() {
  const { gradeDisputes } = useServices();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['grade-disputes', 'pending'], queryFn: () => gradeDisputes.listPending() });

  const [newValues, setNewValues] = useState<Record<string, string>>({});

  const decideMutation = useMutation({
    mutationFn: ({ id, approuve }: { id: string; approuve: boolean }) =>
      gradeDisputes.decide(id, {
        approuve,
        nouvelleValeur: approuve ? Number(newValues[id] ?? 0) : undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grade-disputes', 'pending'] }),
  });

  const columns: Column<GradeDispute>[] = [
    { key: 'matiere', header: 'Matière', render: (d) => d.subjectNom ?? '—' },
    { key: 'actuelle', header: 'Note actuelle', render: (d) => (d.valeurActuelle != null ? `${d.valeurActuelle}/20` : '—') },
    { key: 'contestee', header: 'Note contestée', render: (d) => `${d.valeurContestee}/20` },
    { key: 'motif', header: 'Motif', render: (d) => d.motif },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (d) => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
          <Field label="">
            <Input
              type="number"
              min={0}
              max={20}
              step={0.25}
              placeholder="Nouvelle note"
              value={newValues[d.id] ?? ''}
              onChange={(e) => setNewValues((prev) => ({ ...prev, [d.id]: e.target.value }))}
              style={{ width: 90 }}
            />
          </Field>
          <Button
            variant="secondary"
            size="sm"
            loading={decideMutation.isPending}
            onClick={() => decideMutation.mutate({ id: d.id, approuve: true })}
          >
            Approuver
          </Button>
          <Button variant="ghost" size="sm" onClick={() => decideMutation.mutate({ id: d.id, approuve: false })}>
            Rejeter
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Réclamations de notes" subtitle="Réclamations en attente de votre décision." />
      <Card>
        <StateView loading={list.isLoading} error={list.error} empty={list.data?.length === 0}>
          <Table columns={columns} rows={list.data ?? []} rowKey={(d) => d.id} />
        </StateView>
      </Card>
    </div>
  );
}
